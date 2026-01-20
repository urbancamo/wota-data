
<?php
// die("Access denied");
include("dbconfig.php");
$sql = "SELECT * FROM `chaser_log` WHERE `confirmed` = false";
$result = mysql_query($sql,$con);
if (mysql_num_rows($result) ) {
  echo "Updating confirmations for chaser log<br>";
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    $id = $row['id'];
    $stncall = $row['stncall']; // station worked (without /P)
    $summitid = $row['wotaid']; // summit worked
    $wkdby = $row['ucall'];     // call used by chaser
    $date = $row['date'];       // date of contact
    $sql = "SELECT * FROM `activator_log` WHERE `callused` = '".$stncall."' AND `wotaid` = '".$summitid."' AND `ucall` = '".$wkdby."' AND `date` = '".$date."'";
    $result2 = mysql_query($sql,$con);
    if($result2 && (@mysql_num_rows($result2) > 0)) {
      $row2 = mysql_fetch_array($result2, MYSQL_ASSOC);
      $id2 = $row2['id'];
      echo "Contact ".$id." by ".$wkdby." with ".$stncall."/P on ".$date." (".$id2.")<br>";
        mysql_query("UPDATE `chaser_log` SET `confirmed` = true WHERE `id` = ".$id);
        mysql_query("UPDATE `activator_log` SET `confirmed` = true WHERE `id` = ".$id2);
    }
  }
}
echo "Updating confirmations for activator log<br>";
$sql = "SELECT * FROM `activator_log` WHERE `confirmed` = false";
$result = mysql_query($sql,$con);
if (mysql_num_rows($result) ) {
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    $id = $row['id'];
    $stncall = $row['stncall']; // station worked
    $summitid = $row['wotaid']; // summit worked
    $wkdby = $row['callused'];  // call used by activator
    $date = $row['date'];       // date of contact
    $sql = "SELECT * FROM `chaser_log` WHERE `ucall` = '".$stncall."' AND `wotaid` = '".$summitid."' AND `stncall` = '".$wkdby."' AND `date` = '".$date."'";
    $result2 = mysql_query($sql,$con);
    if($result2 && (@mysql_num_rows($result2) > 0)) {
      $row2 = mysql_fetch_array($result2, MYSQL_ASSOC);
      $id2 = $row2['id'];
      echo "Contact ".$id." by ".$wkdby."/P with ".$stncall." on ".$date." (".$id2.")<br>";
      mysql_query("UPDATE `activator_log` SET `confirmed` = true WHERE `id` = ".$id);
      mysql_query("UPDATE `chaser_log` SET `confirmed` = true WHERE `id` = ".$id2);
    }
  }
}
?>
