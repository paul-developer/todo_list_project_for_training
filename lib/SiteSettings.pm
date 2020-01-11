package SiteSettings;
use strict;
use warnings;

require Exporter;
our @ISA = qw(Exporter);
our @EXPORT = qw(%SETTINGS);

our %SETTINGS = (
  'db_user'         => '',
  'db_pass'         => '',
  'db_name'         => '',

  'user_pass_salt'  => '',
);

1;
