<?php
function errstr($str) {
  global $errcount;
  $errcount++;
  return '<span style="color:red;margin-left:4px;">'.$str.'</span>';
}
?>