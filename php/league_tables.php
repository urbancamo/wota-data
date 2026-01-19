include("dbconfig.php");
$self = $_SERVER['PHP_SELF']."?page=".$_REQUEST['page'];
global $gCms;
$feu = & $gCms->modules['FrontEndUsers']['object'];
$ismod = stripos($feu->GetMemberGroups($feu->LoggedInId()),"Moderators") !== false;
$year = isset($_REQUEST['year']) ? mysql_real_escape_string($_REQUEST['year']) : "2000";
$table = isset($_REQUEST['table']) ? mysql_real_escape_string($_REQUEST['table']) : "";
?>
<form action="<?=$self?>" method="POST">
  <table border="0" cellpadding="2" style="margin-left:auto;margin-right:auto;">
    <tr>
      <td>Show:&nbsp;<select name="table">
<option value="ACT" <? if($table=="ACT") echo 'selected="selected"'; ?>>Fell Walkers</option>
<option value="CHA" <? if($table=="CHA") echo 'selected="selected"'; ?>>Fell Chasers</option>
<option value="FR" <? if($table=="FR") echo 'selected="selected"'; ?>>Fell Watchers</option>
</select>
      </td>
      <td>Year: <select name="year">

<option value="2000" <? if($year=="2000") echo 'selected="selected"'; ?>>All time</option>
<option value="2009" <? if($year=="2009") echo 'selected="selected"'; ?>>2009</option>
<option value="2010" <? if($year=="2010") echo 'selected="selected"'; ?>>2010</option>
<option value="2011" <? if($year=="2011") echo 'selected="selected"'; ?>>2011</option>
<option value="2012" <? if($year=="2012") echo 'selected="selected"'; ?>>2012</option>
<option value="2013" <? if($year=="2013") echo 'selected="selected"'; ?>>2013</option>
<option value="2014" <? if($year=="2014") echo 'selected="selected"'; ?>>2014</option>
<option value="2015" <? if($year=="2015") echo 'selected="selected"'; ?>>2015</option>
<option value="2016" <? if($year=="2016") echo 'selected="selected"'; ?>>2016</option>
<option value="2017" <? if($year=="2017") echo 'selected="selected"'; ?>>2017</option>
<option value="2018" <? if($year=="2018") echo 'selected="selected"'; ?>>2018</option>
<option value="2019" <? if($year=="2019") echo 'selected="selected"'; ?>>2019</option>
<option value="2020" <? if($year=="2020") echo 'selected="selected"'; ?>>2020</option>
<option value="2021" <? if($year=="2021") echo 'selected="selected"'; ?>>2021</option>
<option value="2022" <? if($year=="2022") echo 'selected="selected"'; ?>>2022</option>
<option value="2023" <? if($year=="2023") echo 'selected="selected"'; ?>>2023</option>
<option value="2024" <? if($year=="2024") echo 'selected="selected"'; ?>>2024</option>
<option value="2025" <? if($year=="2025") echo 'selected="selected"'; ?>>2025</option>
<option value="2026" <? if($year=="2026") echo 'selected="selected"'; ?>>2026</option>
</select>
      </td>
      <td>
      &nbsp;<input type="submit" value="Show">
      </td>
    </tr>
  </table>
</form>
<?
if(!empty($table)) {
  switch($table) {
    case "ACT":
      $sql = "SELECT * FROM `table` WHERE `year` = ".$year." AND `actpts` > 0 ORDER BY `actpts` DESC";
      $rn = "actpts";
      $listurl = "mm_home/mm_activatorcontacts.html?table=ACT";
      if($year!=="2000") $listurl .= "&amp;year=".$year;
      $listurl .= "&amp;user=";
      break;
    case "CHA":
      $sql = "SELECT * FROM `table` WHERE `year` = ".$year." AND `pbpts` > 0 ORDER BY `pbpts` DESC";
      $rn = "pbpts";
      $listurl = "mm_home/mm_chasercontacts.html?table=CHA";
      if($year!=="2000") $listurl .= "&amp;year=".$year;
      $listurl .= "&amp;user=";
      break;
    case "FR":
      $sql = "SELECT * FROM `table` WHERE `year` = ".$year." AND `frpts` > 0 ORDER BY `frpts` DESC";
      $rn = "frpts";
      $listurl = "mm_home/mm_chasercontacts.html?table=FR";
      if($year!=="2000") $listurl .= "&amp;year=".$year;
      $listurl .= "&amp;user=";
      break;
  }
  $result = mysql_query($sql,$con);
  echo "<br/><center><table width=\"60%\" cellpadding=\"2\" cellspacing=\"2\">";
  echo "<tr><th width=\"50%\">Call</th><th>Points</th></tr>";
  $n = 0;
  $d = 0;
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    $n++;
    $d++;
    if($d>1) $d=0;
    echo "<tr class=\"tbl_alt".$d."\">";
    if($ismod) {
      echo "<td style=\"text-align:center\"><a href=\"".$listurl.$row['call']."\">".$row['call']."</a></td>";
    } else {
      echo "<td style=\"text-align:center\">".$row['call']."</td>";
    }
    echo "<td style=\"text-align:center\">".$row[$rn]."</td></tr>";
  }
  echo "</table></center>";
}