#!/usr/bin/perl
use strict;
use warnings;
use DBI;

use lib '../lib';
use ToDoList;
use SiteSettings;

use CGI::Fast
    socket_path  => '127.0.0.1:9000',
    listen_queue => 3;

while (my $req_obj = CGI::Fast->new) {

   my $db_obj = DBI->connect("dbi:Pg:dbname=$SETTINGS{db_name}", $SETTINGS{'db_user'}, $SETTINGS{'db_pass'}, {AutoCommit => 1, RaiseError => 1});
   $db_obj->do(q[SET search_path TO public]);

   my $self = ToDoList->new(QUERY => $req_obj);

   $self->{'dbh'} = $db_obj;

   $self->run();

   $db_obj->disconnect;
}

exit(0);
