<?php
// convert activator call to <G call>/P
function pcall($call) {
  $pcall = strtoupper($call."/P");
  if(!is_numeric(substr($pcall,1,1))) {
    if(is_numeric(substr($pcall,0,1))) {
      // 2x0AAA
      $pcall = substr($pcall,0,1).'E'.substr($pcall,2);
    } else {
      $pcall = substr($pcall,0,1).substr($pcall,2);
    }
  }
  return $pcall;
}
?>