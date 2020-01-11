package ToDoList;
use strict;
use base 'CGI::Application';

use Digest::SHA 'sha512_hex';
use JSON;
use Session::Token;

use SiteSettings;

our $dbh;

sub setup {
  my $self = shift;

  $self->tmpl_path('../html');

  $self->mode_param('run');
  $self->start_mode('index_page');
  $self->run_modes(
    'AUTOLOAD'                 => 'index_page',
    'index_page'               => 'index_page',

    'login_page'               => 'login_page',
    'login_run'                => 'login_run',
    'logout_go'                => 'logout_go',
    'auth_fail_answer_get'     => 'auth_fail_answer_get',

    'todolists_get'            => 'todolists_get',
    'todolist_add_run'         => 'todolist_add_run',
    'todolist_edit_run'        => 'todolist_edit_run',
    'todolist_delete_run'      => 'todolist_delete_run',
    'todolist_sort_run'        => 'todolist_sort_run',

    'tasklist_get'             => 'tasklist_get',
    'tasklist_add_run'         => 'tasklist_add_run',
    'tasklist_edit_run'        => 'tasklist_edit_run',
    'tasklist_edit_status_run' => 'tasklist_edit_status_run',
    'tasklist_delete_run'      => 'tasklist_delete_run',
    'tasklist_sort_run'        => 'tasklist_sort_run',
  );
  $self->error_mode('server_error_handler');
}

sub cgiapp_prerun {
  my $self = shift;
  $self->header_add(-charset, 'utf-8');

  $dbh = $self->{'dbh'};

  my $now_mode = $self->query->url_param('run');
  $self->prerun_mode($now_mode);

  if ($self->query->request_method() eq 'POST') {
    $self->header_add(-type, 'application/json');
    my $postdata = $self->query->param('POSTDATA');

    if ($postdata) {
      eval {
        $self->{'req_data'} = from_json($postdata);
      };
    }
    $self->{'req_data'} = {} unless $self->{'req_data'};
  }

  return if (($now_mode eq 'login_page') or ($now_mode eq 'login_run'));

  my $user_id_cookie = $self->query->cookie('todolist_user_id');
  my $session_id_cookie = $self->query->cookie('todolist_user_session');

  my $db_user_session;
  if ($user_id_cookie && $session_id_cookie) {
    $db_user_session = $dbh->selectrow_hashref(q[SELECT id, user_id
                                                FROM user_session
                                                WHERE user_id=? AND session_id=? AND valid_until > NOW() AND activity='active' LIMIT 1],undef,
                                                $user_id_cookie,$session_id_cookie);
  }

  unless ($db_user_session) {
    if ($self->query->request_method() eq 'POST') {
      $self->prerun_mode('auth_fail_answer_get');
    }
    else {
      $self->prerun_mode('login_page');
    }
  }
  else {
    $self->{'user_id'} = $db_user_session->{'user_id'};

    if ($now_mode ne 'logout_go') {
      $dbh->do(q[UPDATE user_session SET valid_until=NOW() + INTERVAL '1 hour' WHERE id=?],undef,$db_user_session->{'id'});

      my $new_user_id_cookie = $self->query->cookie(-name => 'todolist_user_id', -value => "$user_id_cookie", -expires => '+1h');
      my $new_user_session_cookie = $self->query->cookie(-name => 'todolist_user_session', -value => "$session_id_cookie", -expires => '+1h');
      $self->header_add(-cookie => [$new_user_id_cookie, $new_user_session_cookie]);
    }
  }

  return;
}

sub server_error_handler {
  my $self = shift;

  warn $@;

  return return_error('Server error','server_error');
}

sub return_error {
  my ($description, $code) = @_;
  my %return = ('status' => 'error', 'description' => $description);
  $return{'code'} = $code ? $code : 'error';
  return to_json(\%return);
}

sub return_success {
  my $data = shift;
  my %return  = ('status' => 'ok');
  $return{'data'} = $data if $data;
  return to_json(\%return);
}

#WEB FUNCTIONS
##################################################

sub login_page {
  my $self = shift;
  return $self->load_tmpl('login.html')->output();
}

sub login_run {
  my $self = shift;

  sleep(1);

  return &return_error('Auth params error') if (!$self->{'req_data'}->{'user_name'} or !$self->{'req_data'}->{'password'});

  my $user_db_pass = sha512_hex($SETTINGS{'user_pass_salt'}.$self->{'req_data'}->{'password'}.$self->{'req_data'}->{'user_name'});

  my $user = $dbh->selectrow_hashref(q[SELECT id, activity FROM public."user" WHERE name=? AND password=?],undef,
    $self->{'req_data'}->{'user_name'}, $user_db_pass);

  return &return_error('Auth failed','auth_fail') unless $user;
  return &return_error('User is blocked','user_blocked') if ($user->{'activity'} ne 'active');

  my $new_session_id = Session::Token->new(length => 50)->get;
  $dbh->do(q[INSERT INTO user_session (user_id, session_id, created, valid_until) VALUES (?,?,NOW(),NOW() + INTERVAL '1 hour')],undef,
     $user->{'id'},$new_session_id);

  my $user_id_cookie = $self->query->cookie(-name => 'todolist_user_id', -value => "$user->{id}", -expires => '+1h');
  my $user_session_cookie = $self->query->cookie(-name => 'todolist_user_session', -value => "$new_session_id", -expires => '+1h');
  $self->header_add(-cookie => [$user_id_cookie, $user_session_cookie]);

  return &return_success('auth_ok');
}

sub logout_go {
  my $self = shift;

  my $session_id_cookie = $self->query->cookie('todolist_user_session');

  $dbh->do(q[UPDATE user_session SET activity='inactive' WHERE user_id=? AND session_id=?],undef,$self->{'user_id'},$session_id_cookie);

  my $user_id_cookie = $self->query->cookie(-name => 'todolist_user_id', -value => '1', -expires => '-1h');
  my $user_session_cookie = $self->query->cookie(-name => 'todolist_user_session', -value => '1', -expires => '-1h');
  $self->header_add(-cookie => [$user_id_cookie, $user_session_cookie]);

  return q[<html><head><meta http-equiv="refresh" content="0; URL=?run=login_page" /></head></html>];
}

sub auth_fail_answer_get {
  my $self = shift;
  return &return_error('Auth failed','auth_fail');
}

sub index_page {
  my $self = shift;

  my $user_name = $dbh->selectrow_array(q[SELECT name FROM public."user" WHERE id=?],undef,$self->{'user_id'});

  my $tmpl_obj = $self->load_tmpl('index.html');
  $tmpl_obj->param('USER_NAME' => $user_name);
  return $tmpl_obj->output();
}

sub todolists_get {
  my $self = shift;

  my $list = $dbh->selectall_arrayref(q[SELECT id, name, created, priority FROM to_do_list WHERE user_id=? ORDER BY priority ASC],
    {'Slice' => {}},
    $self->{'user_id'}
  );

  return &return_success($list);
}

sub todolist_add_run {
  my $self = shift;

  my $double = $dbh->selectrow_array(q[SELECT id FROM to_do_list WHERE name=? AND user_id=? LIMIT 1],undef,
    $self->{'req_data'}->{'tdl_name'},
    $self->{'user_id'}
  );

  return return_error('New todolist name is already exist','tdl_duble_name') if $double;

  $dbh->do(q[INSERT INTO to_do_list
      (user_id, name, priority)
	    VALUES (?, ?, (SELECT COALESCE(MAX(priority)+1,1) FROM to_do_list WHERE user_id=?) )],undef,
      $self->{'user_id'},
      $self->{'req_data'}->{'tdl_name'},
      $self->{'user_id'}
  );
  my $tdl_id = $dbh->last_insert_id(undef,undef,'to_do_list');

  my $tdl = $dbh->selectrow_hashref(q[SELECT id, name, created, priority FROM to_do_list WHERE id=? AND user_id=?],undef,
    $tdl_id,
    $self->{'user_id'}
  );

  return &return_success($tdl);
}

sub todolist_edit_run {
  my $self = shift;

  my $double = $dbh->selectrow_array(q[SELECT id FROM to_do_list WHERE name=? AND user_id=? LIMIT 1],undef,
    $self->{'req_data'}->{'tdl_name'},
    $self->{'user_id'}
  );

  return return_error('New todolist name is already exist','tdl_duble_name') if $double;

  my $edit_count = $dbh->do(q[UPDATE to_do_list SET name=? WHERE user_id=? AND id=?],undef,
    $self->{'req_data'}->{'tdl_name'},
    $self->{'user_id'},
    $self->{'req_data'}->{'to_do_list_id'}
  );

  return return_error('Todo list not found','todolist_not_found') if ($edit_count ne '1');

  return &return_success();
}

sub todolist_delete_run {
  my $self = shift;

  $dbh->do(q[DELETE FROM to_do_list WHERE user_id=? AND id=?],undef,$self->{'user_id'},$self->{'req_data'}->{'to_do_list_id'});

  return &return_success();
}

sub todolist_sort_run {
  my $self = shift;

  return return_error() if (
    !$self->{'req_data'} ||
    !$self->{'req_data'}->{'sorted_arr'} ||
    (ref($self->{'req_data'}->{'sorted_arr'}) ne 'ARRAY') ||
    !@{$self->{'req_data'}->{'sorted_arr'}}
  );

  my $update_srt = '';
  my $i = 1;
  foreach my $id (@{$self->{'req_data'}->{'sorted_arr'}}) {
    my $q_id = $dbh->quote($id);
    $update_srt .= '('.$q_id.qq[::int,$i),];
    $i++;
  }
  chop $update_srt;

  my $count = $dbh->selectrow_array(q[SELECT COUNT(id) FROM to_do_list WHERE user_id=?],undef,$self->{'user_id'});
  return return_error('Some todolists not found','some_todolist_not_found') if ($count ne scalar @{$self->{'req_data'}->{'sorted_arr'}});

  $dbh->do(qq[UPDATE to_do_list SET priority = sorted.priority
            FROM (VALUES $update_srt) AS sorted (id, priority)
            WHERE to_do_list.id=sorted.id AND to_do_list.user_id=?],
      undef,$self->{'user_id'});

  return &return_success();
}

sub tasklist_get {
  my $self = shift;

  my $list = $dbh->selectall_arrayref(
    q[SELECT
        id, content, created, do_before, done,
        CASE
          WHEN do_before > (NOW() + INTERVAL '1 DAY') THEN 'no'
          WHEN do_before > NOW() THEN 'soon'
          WHEN do_before <= NOW() THEN 'expired'
          ELSE NULL
        END AS do_before_expire
      FROM task WHERE user_id=? AND to_do_list_id=? ORDER BY priority ASC],
    {'Slice' => {}},
    $self->{'user_id'},
    $self->{'req_data'}->{'to_do_list_id'}
  );

  return &return_success({'to_do_list_id' => "$self->{'req_data'}->{'to_do_list_id'}", 'task_list' => $list});
}

sub tasklist_add_run {
  my $self = shift;

  my $todo_list_exist = $dbh->selectrow_array(q[SELECT id FROM to_do_list WHERE id=? AND user_id=?],undef,
    $self->{'req_data'}->{'to_do_list_id'},
    $self->{'user_id'}
  );
  return &return_error('Todo list not found','todolist_not_found') unless $todo_list_exist;

  $dbh->do(q[INSERT INTO task
      (user_id, to_do_list_id, content, do_before, priority)
	    VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(priority)+1,1) FROM task WHERE user_id=? AND to_do_list_id=?) )],undef,
      $self->{'user_id'},
      $self->{'req_data'}->{'to_do_list_id'},
      $self->{'req_data'}->{'content'},
      $self->{'req_data'}->{'do_before'},
      $self->{'user_id'},
      $self->{'req_data'}->{'to_do_list_id'}
  );

  my $task_id = $dbh->last_insert_id(undef,undef,'task');

  my $new_task = $dbh->selectrow_hashref(
    q[SELECT
        id, content, created, do_before,
        CASE
          WHEN do_before > (NOW() + INTERVAL '1 DAY') THEN 'no'
          WHEN do_before > NOW() THEN 'soon'
          WHEN do_before <= NOW() THEN 'expired'
          ELSE NULL
        END AS do_before_expire
      FROM task WHERE user_id=? AND id=? ORDER BY priority ASC],
    undef,
    $self->{'user_id'},
    $task_id
  );

  return &return_success({'to_do_list_id' => "$self->{'req_data'}->{'to_do_list_id'}", 'task_list' => [$new_task]});
}

sub tasklist_edit_run {
  my $self = shift;

  my $edit_count = $dbh->do(q[UPDATE task SET content=?, do_before=? WHERE user_id=? AND id=?],undef,
    $self->{'req_data'}->{'content'},
    $self->{'req_data'}->{'do_before'},
    $self->{'user_id'},
    $self->{'req_data'}->{'task_id'}
  );

  return return_error('Task not found','task_not_found') if ($edit_count ne '1');

  my $task = $dbh->selectrow_hashref(
    q[SELECT
        id, content, created, do_before, done,
        CASE
          WHEN do_before > (NOW() + INTERVAL '1 DAY') THEN 'no'
          WHEN do_before > NOW() THEN 'soon'
          WHEN do_before <= NOW() THEN 'expired'
          ELSE NULL
        END AS do_before_expire
      FROM task WHERE user_id=? AND id=? ORDER BY priority ASC],
    undef,
    $self->{'user_id'},
    $self->{'req_data'}->{'task_id'}
  );

  return &return_success({'task_list' => [$task]});
}

sub tasklist_edit_status_run {
  my $self = shift;

  my $edit_count = $dbh->do(q[UPDATE task SET done=? WHERE user_id=? AND id=?],undef,
    $self->{'req_data'}->{'done'},
    $self->{'user_id'},
    $self->{'req_data'}->{'task_id'}
  );

  return return_error('Task not found','task_not_found') if ($edit_count ne '1');
  return &return_success();
}

sub tasklist_delete_run {
  my $self = shift;

  return return_error() if (
    !$self->{'req_data'} ||
    !$self->{'req_data'}->{'task_del_arr'} ||
    (ref($self->{'req_data'}->{'task_del_arr'}) ne 'ARRAY') ||
    !@{$self->{'req_data'}->{'task_del_arr'}}
  );

  my $in_srt = '';
  foreach my $id (@{$self->{'req_data'}->{'task_del_arr'}}) {
    my $q_id = $dbh->quote($id);
    $in_srt .= qq[$q_id,];
  }
  chop $in_srt;

  my $del_count = $dbh->do(qq[DELETE FROM task WHERE user_id=? AND id IN ($in_srt)],undef,$self->{'user_id'});
  $del_count = 0 if ($del_count eq '0E0');

  return &return_success({'del_count' => $del_count});
}

sub tasklist_sort_run {
  my $self = shift;

  return return_error() if (
    !$self->{'req_data'} ||
    !$self->{'req_data'}->{'sorted_arr'} ||
    (ref($self->{'req_data'}->{'sorted_arr'}) ne 'ARRAY') ||
    !@{$self->{'req_data'}->{'sorted_arr'}}
  );

  my $update_srt = '';
  my $i = 1;
  foreach my $id (@{$self->{'req_data'}->{'sorted_arr'}}) {
    my $q_id = $dbh->quote($id);
    $update_srt .= '('.$q_id.qq[::int,$i),];
    $i++;
  }
  chop $update_srt;

  my $count = $dbh->selectrow_array(q[SELECT COUNT(id) FROM task WHERE to_do_list_id=? AND user_id=?],undef,$self->{'req_data'}->{'to_do_list_id'},$self->{'user_id'});
  return return_error('Some tasks not found','some_tasks_not_found') if ($count ne scalar @{$self->{'req_data'}->{'sorted_arr'}});

  $dbh->do(qq[UPDATE task SET priority = sorted.priority
            FROM (VALUES $update_srt) AS sorted (id, priority)
            WHERE task.id=sorted.id AND task.user_id=?],
      undef,$self->{'user_id'});

  return &return_success();
}



1;
