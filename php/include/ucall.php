<?php
function ucall($call) {
// unify call
  $ucall = strtoupper($call);
  $p = strpos($ucall,"/P");
  if($p > 0) {
    $ucall = substr($ucall,0,$p);
  }
  $p = strpos($ucall,"/M");
  if($p > 0) {
    $ucall = substr($ucall,0,$p);
  }
  $p = strpos($ucall,"/A");
  if($p > 0) {
    $ucall = substr($ucall,0,$p);
  }
  $p = strpos($ucall,"G/");
  if($p === 0) {
    $ucall = substr($ucall,2,8);
  }
  $p = strpos($ucall,"M/");
  if($p === 0) {
    $ucall = substr($ucall,2,8);
  }
  switch(substr($ucall,0,1)) {
    case 'G':
    case 'M':
      if(!is_numeric(substr($ucall,1,1)))
        $ucall = substr($ucall,0,1).substr($ucall,2);
      break;
    case '2':
      $ucall = substr($ucall,0,1).'E'.substr($ucall,2);
      break;
  }
  return $ucall;
}
?>