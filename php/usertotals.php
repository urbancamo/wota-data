include("dbconfig.php");
$self = $_SERVER['PHP_SELF']."?page=".$_REQUEST['page'];
global $gCms;
global $frpt;

function old_act($user,$summit,$con) {
  $r = false;
  $sql = "SELECT COUNT(raa) AS numrows FROM `activator_pts` WHERE `activator` = '".$user."' AND `year` = 2000 AND `wotaid` = ".$summit;
  $result = mysql_query($sql,$con);
  if (mysql_num_rows($result) > 0) {
    $row = mysql_fetch_array($result, MYSQL_ASSOC);
    $points = isset($row['numrows']) ? $row['numrows'] : 0;
    if($points > 0) $r = true;
  }
  return $r;
}

function old_act_yr($user,$year,$summit,$con) {
  $r = false;
  $sql = "SELECT COUNT(raa) AS numrows FROM `activator_pts` WHERE `activator` = '".$user."' AND `year` = ".$year." AND `wotaid` = ".$summit;
  $result = mysql_query($sql,$con);
  if (mysql_num_rows($result) > 0) {
    $row = mysql_fetch_array($result, MYSQL_ASSOC);
    $points = isset($row['numrows']) ? $row['numrows'] : 0;
    if($points > 0) $r = true;
  }
  return $r;
}

function act($user,$summit,$con) {
  $r = false;
  $sql = "SELECT * FROM `activator_log` WHERE `activatedby` = '".$user."' AND `wotaid` = ".$summit;
  $res = mysql_query($sql,$con);
  if($res && (mysql_num_rows($res) > 0)) {
    $r = true;
  }
  return $r;
}

function act_yr($user,$year,$summit,$con) {
  $r = false;
  $sql = "SELECT * FROM `activator_log` WHERE `activatedby` = '".$user."' AND `year` = ".$year." AND `wotaid` = ".$summit;
  $res = mysql_query($sql,$con);
  if($res && (mysql_num_rows($res) > 0)) {
    $r = true;
  }
  return $r;
}

function wkd($user,$summit,$con) {
  global $frpt;
  $r = false;
  $frpt = 0;
  $sql = "SELECT stncall FROM `chaser_log` WHERE `wkdby` = '".$user."' AND `wotaid` = ".$summit;
  $res = mysql_query($sql,$con);
  if (mysql_num_rows($res) > 0) {
    $acalls = "*";
    while($row = mysql_fetch_array($res, MYSQL_ASSOC)) {
      $r = true;
      if(strpos($acalls,"*".$row['stncall'])==0) {
        $frpt++;
        $acalls .= "*".$row['stncall'];
      }
    }
  }
  return $r;
}

function wkd_yr($user,$year,$summit,$con) {
  global $frpt;
  $r = false;
  $frpt = 0;
  $sql = "SELECT stncall FROM `chaser_log` WHERE `wkdby` = '".$user."' AND `year` = ".$year." AND `wotaid` = ".$summit;
  $res = mysql_query($sql,$con);
  if (mysql_num_rows($res) > 0) {
    $acalls = "*";
    while($row = mysql_fetch_array($res, MYSQL_ASSOC)) {
      $r = true;
      if(strpos($acalls,"*".$row['stncall'])==0) {
        $frpt++;
        $acalls .= "*".$row['stncall'];
      }
    }
  }
  return $r;
}

function update_table($year,$call,$pbpts,$frpts,$actpts,$con ) {
  $sql = "SELECT * FROM `table` WHERE `year` = ".$year." AND `call` = '".$call."'";
  $result = mysql_query($sql,$con);
  if($result && (@mysql_num_rows($result) > 0)) {
    $sql = "UPDATE `table` SET `pbpts` = ".$pbpts.", `frpts` = ".$frpts.", `actpts` = ".$actpts." WHERE `year` = ".$year." AND `call` = '".$call."'";
    $result = mysql_query($sql,$con);
  } else {
    $sql = "INSERT INTO `table` (`year`,`call`,`pbpts`,`frpts`,`actpts`) VALUES (".$year.",'".$call."',".$pbpts.",".$frpts.",".$actpts.")";
    $result = mysql_query($sql,$con);
  }
}

function read_table($year,$call,&$pbpts,&$frpts,&$actpts,$con ) {
  $sql = "SELECT * FROM `table` WHERE `year` = ".$year." AND `call` = '".$call."'";
  $result = mysql_query($sql,$con);
  if($result && (@mysql_num_rows($result) > 0)) {
    $row = mysql_fetch_array($result, MYSQL_ASSOC);
    $pbpts = $row['pbpts'];
    $frpts = $row['frpts'];
    $actpts = $row['actpts'];
  } else {
    $pbpts = $frpts = $actpts = 0;
  }
}

$feu = & $gCms->modules['FrontEndUsers']['object'];
$user = strtoupper($feu->LoggedInName());

if($_GET['action']=="update") {
  // update league tables

  // Year tallies
  $wkdpts_2009 = $frpts_2009 = $actpts_2009 = 0;
  $wkdpts_2010 = $frpts_2010 = $actpts_2010 = 0;
  $wkdpts_2011 = $frpts_2011 = $actpts_2011 = 0;
  $wkdpts_2012 = $frpts_2012 = $actpts_2012 = 0;
  $wkdpts_2013 = $frpts_2013 = $actpts_2013 = 0;
  $wkdpts_2014 = $frpts_2014 = $actpts_2014 = 0;
  $wkdpts_2015 = $frpts_2015 = $actpts_2015 = 0;
  $wkdpts_2016 = $frpts_2016 = $actpts_2016 = 0;
  $wkdpts_2017 = $frpts_2017 = $actpts_2017 = 0;
  $wkdpts_2018 = $frpts_2018 = $actpts_2018 = 0;
  $wkdpts_2019 = $frpts_2019 = $actpts_2019 = 0;
  $wkdpts_2020 = $frpts_2020 = $actpts_2020 = 0;
  $wkdpts_2021 = $frpts_2021 = $actpts_2021 = 0;
  $wkdpts_2022 = $frpts_2022 = $actpts_2022 = 0;
  $wkdpts_2023 = $frpts_2023 = $actpts_2023 = 0;
  $wkdpts_2024 = $frpts_2024 = $actpts_2024 = 0;
  $wkdpts_2025 = $frpts_2025 = $actpts_2025 = 0;
  $wkdpts_2026 = $frpts_2026 = $actpts_2026 = 0;

  // Totals
  $wkdpts = $frpts = $actpts = 0;

  $result = mysql_query("SELECT * FROM `summits` ORDER BY wotaid",$con);
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    $summit = substr($row['wotaid'],-3,3);
    if(act($user,$summit,$con)) $actpts++;

    if(act_yr($user,"2009",$summit,$con)) $actpts_2009++;
    if(act_yr($user,"2010",$summit,$con)) $actpts_2010++;
    if(act_yr($user,"2011",$summit,$con)) $actpts_2011++;
    if(act_yr($user,"2012",$summit,$con)) $actpts_2012++;
    if(act_yr($user,"2013",$summit,$con)) $actpts_2013++;
    if(act_yr($user,"2014",$summit,$con)) $actpts_2014++;
    if(act_yr($user,"2015",$summit,$con)) $actpts_2015++;
    if(act_yr($user,"2016",$summit,$con)) $actpts_2016++;
    if(act_yr($user,"2017",$summit,$con)) $actpts_2017++;
    if(act_yr($user,"2018",$summit,$con)) $actpts_2018++;
    if(act_yr($user,"2019",$summit,$con)) $actpts_2019++;
    if(act_yr($user,"2020",$summit,$con)) $actpts_2020++;
    if(act_yr($user,"2021",$summit,$con)) $actpts_2021++;
    if(act_yr($user,"2022",$summit,$con)) $actpts_2022++;
    if(act_yr($user,"2023",$summit,$con)) $actpts_2023++;
    if(act_yr($user,"2024",$summit,$con)) $actpts_2024++;
    if(act_yr($user,"2025",$summit,$con)) $actpts_2025++;
    if(act_yr($user,"2026",$summit,$con)) $actpts_2026++;

    if(wkd($user,$summit,$con)) { $wkdpts++; $frpts = $frpts + $frpt; }

    if(wkd_yr($user,"2009",$summit,$con)) { $wkdpts_2009++; $frpts_2009 = $frpts_2009 + $frpt; }
    if(wkd_yr($user,"2010",$summit,$con)) { $wkdpts_2010++; $frpts_2010 = $frpts_2010 + $frpt; }
    if(wkd_yr($user,"2011",$summit,$con)) { $wkdpts_2011++; $frpts_2011 = $frpts_2011 + $frpt; }
    if(wkd_yr($user,"2012",$summit,$con)) { $wkdpts_2012++; $frpts_2012 = $frpts_2012 + $frpt; }
    if(wkd_yr($user,"2013",$summit,$con)) { $wkdpts_2013++; $frpts_2013 = $frpts_2013 + $frpt; }
    if(wkd_yr($user,"2014",$summit,$con)) { $wkdpts_2014++; $frpts_2014 = $frpts_2014 + $frpt; }
    if(wkd_yr($user,"2015",$summit,$con)) { $wkdpts_2015++; $frpts_2015 = $frpts_2015 + $frpt; }
    if(wkd_yr($user,"2016",$summit,$con)) { $wkdpts_2016++; $frpts_2016 = $frpts_2016 + $frpt; }
    if(wkd_yr($user,"2017",$summit,$con)) { $wkdpts_2017++; $frpts_2017 = $frpts_2017 + $frpt; }
    if(wkd_yr($user,"2018",$summit,$con)) { $wkdpts_2018++; $frpts_2018 = $frpts_2018 + $frpt; }
    if(wkd_yr($user,"2019",$summit,$con)) { $wkdpts_2019++; $frpts_2019 = $frpts_2019 + $frpt; }
    if(wkd_yr($user,"2020",$summit,$con)) { $wkdpts_2020++; $frpts_2020 = $frpts_2020 + $frpt; }
    if(wkd_yr($user,"2021",$summit,$con)) { $wkdpts_2021++; $frpts_2021 = $frpts_2021 + $frpt; }
    if(wkd_yr($user,"2022",$summit,$con)) { $wkdpts_2022++; $frpts_2022 = $frpts_2022 + $frpt; }
    if(wkd_yr($user,"2023",$summit,$con)) { $wkdpts_2023++; $frpts_2023 = $frpts_2023 + $frpt; }
    if(wkd_yr($user,"2024",$summit,$con)) { $wkdpts_2024++; $frpts_2024 = $frpts_2024 + $frpt; }
    if(wkd_yr($user,"2025",$summit,$con)) { $wkdpts_2025++; $frpts_2025 = $frpts_2025 + $frpt; }
    if(wkd_yr($user,"2026",$summit,$con)) { $wkdpts_2026++; $frpts_2026 = $frpts_2026 + $frpt; }
  }

  // year 2000 row contains the totals
  update_table(2000,$user,$wkdpts,$frpts,$actpts,$con);

  update_table(2009,$user,$wkdpts_2009,$frpts_2009,$actpts_2009,$con);
  update_table(2010,$user,$wkdpts_2010,$frpts_2010,$actpts_2010,$con);
  update_table(2011,$user,$wkdpts_2011,$frpts_2011,$actpts_2011,$con);
  update_table(2012,$user,$wkdpts_2012,$frpts_2012,$actpts_2012,$con);
  update_table(2013,$user,$wkdpts_2013,$frpts_2013,$actpts_2013,$con);
  update_table(2014,$user,$wkdpts_2014,$frpts_2014,$actpts_2014,$con);
  update_table(2015,$user,$wkdpts_2015,$frpts_2015,$actpts_2015,$con);
  update_table(2016,$user,$wkdpts_2016,$frpts_2016,$actpts_2016,$con);
  update_table(2017,$user,$wkdpts_2017,$frpts_2017,$actpts_2017,$con);
  update_table(2018,$user,$wkdpts_2018,$frpts_2018,$actpts_2018,$con);
  update_table(2019,$user,$wkdpts_2019,$frpts_2019,$actpts_2019,$con);
  update_table(2020,$user,$wkdpts_2020,$frpts_2020,$actpts_2020,$con);
  update_table(2021,$user,$wkdpts_2021,$frpts_2021,$actpts_2021,$con);
  update_table(2022,$user,$wkdpts_2022,$frpts_2022,$actpts_2022,$con);
  update_table(2023,$user,$wkdpts_2023,$frpts_2023,$actpts_2023,$con);
  update_table(2024,$user,$wkdpts_2024,$frpts_2024,$actpts_2024,$con);
  update_table(2025,$user,$wkdpts_2025,$frpts_2025,$actpts_2025,$con);
  update_table(2026,$user,$wkdpts_2026,$frpts_2026,$actpts_2026,$con);

} else {

  // year 2000 row contains the totals
  read_table(2000,$user,$wkdpts,$frpts,$actpts,$con);

  read_table(2009,$user,$wkdpts_2009,$frpts_2009,$actpts_2009,$con);
  read_table(2010,$user,$wkdpts_2010,$frpts_2010,$actpts_2010,$con);
  read_table(2011,$user,$wkdpts_2011,$frpts_2011,$actpts_2011,$con);
  read_table(2012,$user,$wkdpts_2012,$frpts_2012,$actpts_2012,$con);
  read_table(2013,$user,$wkdpts_2013,$frpts_2013,$actpts_2013,$con);
  read_table(2014,$user,$wkdpts_2014,$frpts_2014,$actpts_2014,$con);
  read_table(2015,$user,$wkdpts_2015,$frpts_2015,$actpts_2015,$con);
  read_table(2016,$user,$wkdpts_2016,$frpts_2016,$actpts_2016,$con);
  read_table(2017,$user,$wkdpts_2017,$frpts_2017,$actpts_2017,$con);
  read_table(2018,$user,$wkdpts_2018,$frpts_2018,$actpts_2018,$con);
  read_table(2019,$user,$wkdpts_2019,$frpts_2019,$actpts_2019,$con);
  read_table(2020,$user,$wkdpts_2020,$frpts_2020,$actpts_2020,$con);
  read_table(2021,$user,$wkdpts_2021,$frpts_2021,$actpts_2021,$con);
  read_table(2022,$user,$wkdpts_2022,$frpts_2022,$actpts_2022,$con);
  read_table(2023,$user,$wkdpts_2023,$frpts_2023,$actpts_2023,$con);
  read_table(2024,$user,$wkdpts_2024,$frpts_2024,$actpts_2024,$con);
  read_table(2025,$user,$wkdpts_2025,$frpts_2025,$actpts_2025,$con);
  read_table(2026,$user,$wkdpts_2026,$frpts_2026,$actpts_2026,$con);

}

?>
<table style="font-family: monospace; font-size: 165%" width="75%" border="0" cellspacing="8" cellpadding="8">
<tr>
    <th width="25%">Total<br>points</th>
    <th width="25%" align="right" title="The number of Unique Fells you have made contact with over the year"><span style="color: #527310;">&#8505;</span> Fell<br>Chaser</th>
    <th width="25%" align="right" title="The number of Fell Walkers you have made contact with over the year"><span style="color: #527310;">&#8505;</span> Fell<br>Watcher</th>
    <th width="25%" align="right" title="The number of Fells you have Activated over the year"><span style="color: #527310;">&#8505;</span> Fell<br>Walker</th>
    <th></th>
</tr>

<tr><td>2009</td><td style="text-align:right;"><?=$wkdpts_2009?></td><td style="text-align:right;"><?=$frpts_2009?></td><td style="text-align:right;"><?=$actpts_2009?></td><td></td></tr>

<tr><td>2010</td><td style="text-align:right;"><?=$wkdpts_2010?></td><td style="text-align:right;"><?=$frpts_2010?></td><td style="text-align:right;"><?=$actpts_2010?></td><td></td></tr>

<tr><td>2011</td><td style="text-align:right;"><?=$wkdpts_2011?></td><td style="text-align:right;"><?=$frpts_2011?></td><td style="text-align:right;"><?=$actpts_2011?></td><td></td></tr>

<tr><td>2012</td><td style="text-align:right;"><?=$wkdpts_2012?></td><td style="text-align:right;"><?=$frpts_2012?></td><td style="text-align:right;"><?=$actpts_2012?></td><td></td></tr>

<tr><td>2013</td><td style="text-align:right;"><?=$wkdpts_2013?></td><td style="text-align:right;"><?=$frpts_2013?></td><td style="text-align:right;"><?=$actpts_2013?></td><td></td></tr>

<tr><td>2014</td><td style="text-align:right;"><?=$wkdpts_2014?></td><td style="text-align:right;"><?=$frpts_2014?></td><td style="text-align:right;"><?=$actpts_2014?></td><td></td></tr>

<tr><td>2015</td><td style="text-align:right;"><?=$wkdpts_2015?></td><td style="text-align:right;"><?=$frpts_2015?></td><td style="text-align:right;"><?=$actpts_2015?></td><td></td></tr>

<tr><td>2016</td><td style="text-align:right;"><?=$wkdpts_2016?></td><td style="text-align:right;"><?=$frpts_2016?></td><td style="text-align:right;"><?=$actpts_2016?></td><td></td></tr>

<tr><td>2017</td><td style="text-align:right;"><?=$wkdpts_2017?></td><td style="text-align:right;"><?=$frpts_2017?></td><td style="text-align:right;"><?=$actpts_2017?></td><td></td></tr>

<tr><td>2018</td><td style="text-align:right;"><?=$wkdpts_2018?></td><td style="text-align:right;"><?=$frpts_2018?></td><td style="text-align:right;"><?=$actpts_2018?></td><td></td></tr>

<tr><td>2019</td><td style="text-align:right;"><?=$wkdpts_2019?></td><td style="text-align:right;"><?=$frpts_2019?></td><td style="text-align:right;"><?=$actpts_2019?></td><td></td></tr>

<tr><td>2020</td><td style="text-align:right;"><?=$wkdpts_2020?></td><td style="text-align:right;"><?=$frpts_2020?></td><td style="text-align:right;"><?=$actpts_2020?></td><td></td></tr>

<tr><td>2021</td><td style="text-align:right;"><?=$wkdpts_2021?></td><td style="text-align:right;"><?=$frpts_2021?></td><td style="text-align:right;"><?=$actpts_2021?></td><td></td></tr>

<tr><td>2022</td><td style="text-align:right;"><?=$wkdpts_2022?></td><td style="text-align:right;"><?=$frpts_2022?></td><td style="text-align:right;"><?=$actpts_2022?></td><td></td></tr>

<tr><td>2023</td><td style="text-align:right;"><?=$wkdpts_2023?></td><td style="text-align:right;"><?=$frpts_2023?></td><td style="text-align:right;"><?=$actpts_2023?></td><td></td></tr>

<tr><td>2024</td><td style="text-align:right;"><?=$wkdpts_2024?></td><td style="text-align:right;"><?=$frpts_2024?></td><td style="text-align:right;"><?=$actpts_2024?></td><td></td></tr>

<tr><td>2025</td><td style="text-align:right;"><?=$wkdpts_2025?></td><td style="text-align:right;"><?=$frpts_2025?></td><td style="text-align:right;"><?=$actpts_2025?></td><td></td></tr>

<tr><td>2026</td><td style="text-align:right;"><?=$wkdpts_2026?></td><td style="text-align:right;"><?=$frpts_2026?></td><td style="text-align:right;"><?=$actpts_2026?></td><td></td></tr>

<tr><td><b>All time</b></td>
  <td style="text-align:right;" title="The total number of Unique Fells you have Chased"><span style="color: #527310;">&#8505;</span>&nbsp;<?=$wkdpts?></td>
  <td style="text-align:right;" title="The total number of Fells you have Chased over all years"><span style="color: #527310;">&#8505;</span>&nbsp;<?=$frpts?></td>
  <td style="text-align:right;" title="The total number of Unique Fells you have Activated"><span style="color: #527310;">&#8505;</span>&nbsp;<?=$actpts?></td>
  <td style="text-align:right;">

  <a title="Update totals" href="<?=$self?>&amp;action=update"><b>Update</b></A></td></tr>
</table>
<?