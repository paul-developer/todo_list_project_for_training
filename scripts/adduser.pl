#!/usr/bin/perl
use strict;
use warnings;
use DBI;
use Digest::SHA 'sha512_hex';

use lib '../lib';
use SiteSettings;

print "Name:\n";
my $user_name = <STDIN>;

print "Password:\n";
my $user_password = <STDIN>;

chomp ($user_name, $user_password);

if (!$user_name or ($user_name eq '') or !$user_password or ($user_password eq '')) {
  print "Incorrect input\n";
  exit(0);
}

my $dbh = DBI->connect("dbi:Pg:dbname=$SETTINGS{db_name}", $SETTINGS{'db_user'}, $SETTINGS{'db_pass'}, {AutoCommit => 1});


my $double = $dbh->selectrow_array(q[SELECT id FROM public."user" WHERE name=?],undef,$user_name);
unless ($double) {

  my $user_db_pass = sha512_hex($SETTINGS{'user_pass_salt'}.$user_password.$user_name);

  $dbh->do(q[INSERT INTO public."user" (name,password) VALUES (?,?)],
    undef, $user_name, $user_db_pass);

  my $user_id = $dbh->last_insert_id(undef, undef, 'user', undef);
  print "New user ID: $user_id\n";
}
else {
  print "Such user already exists\n";
}

$dbh->disconnect;

exit(0);
