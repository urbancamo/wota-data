include("dbconfig.php");
include_once("include/errstr.php");
include_once("include/ucall.php");

function stncall($call) {
    $ucall = strtoupper($call);
    $p = strpos($ucall,"/P");
    if($p > 2) {
        $ucall = substr($ucall,0,$p);
    }
    return $ucall;
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

function logcontact($call,$summitid,$activator,$callused,$date,$s2s,$band,$mode,$con) {
    global $valid_cnt;
    if($call!=="") {
        $tz = new DateTimeZone('GMT');
        $dt = new DateTime($date, $tz);
        $year = substr($date,0,4);

        // replace $wotaid = "LDW-".substr("000".$summitid,-3,3);

        $fellid = (int)$summitid;
        if ($fellid <= 214) {$prefix = "LDW-";}
        else {$prefix = "LDO-";

        $fellid = (int)$fellid-214;}
        $ldid = $prefix . str_pad($fellid,3,"0",STR_PAD_LEFT);
        $wotaid = $ldid;

        echo "<p>Contact with $call from $wotaid on ".$dt->format('D j M Y')." ";
        // check it is not already in log
        $sql = "SELECT * FROM `activator_log` WHERE `activatedby` = '".$activator."' AND `wotaid` = '".$summitid."' AND
        `stncall` = '".$call."' AND `date` = '".$date."' AND `band` = '".$band."' AND `mode` = '".$mode."'";
        $result = mysql_query($sql,$con);
        if($result && (mysql_num_rows($result) > 0)) {
            echo "already in log.</p>";
        } else {
            // check confirmation
            $sql = "SELECT * FROM `chaser_log` WHERE `ucall` = '".$call."' AND `wotaid` = '".$summitid."' AND `stncall` = '".$callused."' AND `date` = '".$date."'";
            $result = mysql_query($sql,$con);
            if($result && (@mysql_num_rows($result) > 0)) {
                $cfm = "true";
                // update record
                mysql_query("UPDATE `chaser_log` SET `confirmed` = true WHERE `ucall` = '".$call."' AND `wotaid` = '".$summitid."' AND `stncall` = '".$callused."' AND `date` = '".$date."'");
                echo "Confirmed ";
            } else {
                $cfm = "false";
            }
            // add contact
            $sql = "INSERT into `activator_log` (`activatedby`, `callused`, `wotaid`, `date`, `year`, `stncall`, `ucall`, `s2s`, `band`, `mode`, `confirmed`) VALUES ('".$activator."','".$callused."',".$summitid.",'".$date."',".$year.",'".$call."','".ucall($call)."',".$s2s.",'".$band."','".$mode."',".$cfm.")";
            $result = mysql_query($sql,$con);
            echo "Logged</p>";
            $valid_cnt++;
        }
    }
}

$self = $_SERVER['PHP_SELF']."?page=".$_REQUEST['page'];
// initialization
global $gCms;
$feu =& $gCms->modules['FrontEndUsers']['object'];
$logged_by = $feu->LoggedInName();
$callused = ucall($logged_by)."/P";
global $errcount;
$errcount = 0;
global $valid_cnt;
$valid_cnt = 0;
if($_SERVER['REQUEST_METHOD'] == "POST") {
    // load the form fields
    $date = isset($_POST['date1']) ? mysql_real_escape_string($_POST['date1']) : "";
    $tz = new DateTimeZone('GMT');
    $dt = new DateTime($date, $tz);
    $year = substr($date,0,4);
    $summitid = mysql_real_escape_string($_POST['summit']);

    // replace $wotaid = "LDW-".substr("000".$summitid,-3,3);

    $fellid = (int)$summitid;
    if ($fellid <= 214) {$prefix = "LDW-";}
    else {$prefix = "LDO-";

    $fellid = (int)$fellid-214;}
    $ldid = $prefix . str_pad($fellid,3,"0",STR_PAD_LEFT);
    $wotaid = $ldid;

    $activator = strtoupper(trim(mysql_real_escape_string($_POST['logged_by'])));
    $callused = stncall(strtoupper(trim(mysql_real_escape_string($_POST['call_used']))));

    $call_1 = strtoupper(trim(mysql_real_escape_string($_POST['contact_1'])));
    $s2s_1 = isset($_POST['s2s_1']) ? "true" : "false";
    $mode_1 = $_POST['mode_1'];
    $band_1 = $_POST['band_1'];

    $call_2 = strtoupper(trim(mysql_real_escape_string($_POST['contact_2'])));
    $s2s_2 = isset($_POST['s2s_2']) ? "true" : "false";
    $mode_2 = $_POST['mode_2'];
    $band_2 = $_POST['band_2'];

    $call_3 = strtoupper(trim(mysql_real_escape_string($_POST['contact_3'])));
    $s2s_3 = isset($_POST['s2s_3']) ? "true" : "false";
    $mode_3 = $_POST['mode_3'];
    $band_3 = $_POST['band_3'];

    $call_4 = strtoupper(trim(mysql_real_escape_string($_POST['contact_4'])));
    $s2s_4 = isset($_POST['s2s_4']) ? "true" : "false";
    $mode_4 = $_POST['mode_4'];
    $band_4 = $_POST['band_4'];

    $cnt = isset($_POST['cnt']) ? trim(mysql_real_escape_string($_POST['cnt'])) : "0";
    $valid_cnt = isset($_POST['vcnt']) ? trim(mysql_real_escape_string($_POST['vcnt'])) : "0";
    if($call_1=="") {
        $message = errstr("No contacts specified");
    }
    switch($year) {
        case '2009': break;
        case '2010': break;
        case '2011': break;
        case '2012': break;
        case '2013': break;
        case '2014': break;
        case '2015': break;
        case '2016': break;
        case '2017': break;
        case '2018': break;
        case '2019': break;
        case '2020': break;
        case '2021': break;
        case '2022': break;
        case '2023': break;
        case '2024': break;
        case '2025': break;
        case '2026': break;
        default: $message = errstr("Cannot log contacts for year ".$year);
    }
}
if(($_SERVER['REQUEST_METHOD'] == "POST")&&($errcount==0)) {
    $act = act($activator,$summitid,$con);
    $act_yr = act_yr($activator,$year,$summitid,$con);
    logcontact($call_1,$summitid,$activator,$callused,$date,$s2s_1,$band_1,$mode_1,$con);
    logcontact($call_2,$summitid,$activator,$callused,$date,$s2s_2,$band_2,$mode_2,$con);
    logcontact($call_3,$summitid,$activator,$callused,$date,$s2s_3,$band_3,$mode_3,$con);
    logcontact($call_4,$summitid,$activator,$callused,$date,$s2s_4,$band_4,$mode_4,$con);
    if($valid_cnt >= 1) {
        if(!$act_yr) {
            echo "<p>Activator points for $year table awarded: 1</p>";
        }
        if(!$act) {
            echo "<p>Activator points for all-time table awarded: 1</p>";
        }
        // set last activator details in summit table
        mysql_query("UPDATE `summits` SET `last_act_by` = '".$activator."', `last_act_date` = '".$date."' WHERE `wotaid` = '".$summitid."'");
    } else {
        echo "<p>No records inserted ";
        echo mysql_error();
        echo "</p>";
    }
    $summitid = $summitid + 0;
?>
<br>
<h3>Log more contacts</h3>
<form action="<?= $self ?>" method="POST">
    <input type="hidden" name="logged_by" value="<?= $logged_by ?>">
    <input type="hidden" name="call_used" value="<?= $callused ?>">
    <input type="hidden" name="date1" value="<?= $date ?>">
    <input type="hidden" name="summit" value="<?= $summitid ?>">
    <table border="0" cellpadding="2">
        <tr>
            <td width="25%" style="padding-top:4px;padding-bottom:4px;">Date of activation:&nbsp;</td>
            <td><?= $dt->format('j M Y') ?></td>
        </tr>
        <tr>
            <td width="25%" style="padding-top:4px;padding-bottom:4px;">Summit:</td>
            <td width="75%"><?= $wotaid ?></td>
        </tr>
        <?
} else {
  require_once('classes/tc_calendar.php');
  //instantiate class and set properties
  $myCalendar = new tc_calendar("date1", true);
  $myCalendar->setIcon("images/iconCalendar.gif");
  $myCalendar->setDate(date(d),date(m),date(Y));
  // set contact count
  $cnt = 0;
  // show error message, if any
  if($errcount > 0) echo $message;
  // display the form
?>
        <script language="javascript" src="calendar.js"></script>
        <form action="<?= $self ?>" method="POST">
            <input type="hidden" name="logged_by" value="<?= $logged_by ?>">
            <table border="0" cellpadding="2">
                <tr>
                    <td>Date of activation:&nbsp;</td>
                    <td><? $myCalendar->writeScript(); ?></td>
                </tr>
                <tr>
                    <td>Callsign used:&nbsp;</td>
                    <td><input type="text" size="8" name="call_used" value="<?= $callused ?>"></td>
                </tr>
                <tr>
                    <td width="25%">Summit:</td>
                    <td width="75%">
                        <select name="summit">
                            <?
                            $result = mysql_query("SELECT `wotaid`,`sotaid`,`name` FROM `summits` WHERE `wotaid` > 0 ORDER BY `name`", $con);
                            if (mysql_num_rows($result)) {
                                while ($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
                                    $val = $row['wotaid'] + 0;

                                    //  $wotaid = "LDW-".substr($row['wotaid'],-3,3);

                                    $fellid1 = substr($row['wotaid'], -3, 3);
                                    $fellid = (int)$fellid1;
                                    if ($fellid <= 214) {
                                        $prefix = "LDW-";
                                    } else {
                                        $prefix = "LDO-";
                                        $fellid = (int)$fellid - 214;
                                    }
                                    $ldid = $prefix . str_pad($fellid, 3, "0", STR_PAD_LEFT);
                                    $wotaid = $ldid;
                                    $sotaid = "";
                                    if ($row['sotaid'] != '') {
                                        $sotano = (int)$row['sotaid'];
                                        $sotaref = "G/LD-" . str_pad($sotano, 3, "0", STR_PAD_LEFT);
                                        $sotaid = "[" . $sotaref . "]";
                                    }
                                    echo "<option value=\"" . $val . "\">" . $row['name'] . " (" . $wotaid . ") " . $sotaid . " </option>";
                                }
                            }
                            ?>
                        </select>
                    </td>
                    <?
                    }
                    ?>
                </tr>
                <tr>
                    <td>Contact <? $cnt++;
                        echo $cnt; ?>:
                    </td>
                    <td>
                        <label for="contact_1"></label>
                        <input type="text" size="8" id="contact_1" name="contact_1">
                        <label for="s2s_1">&nbsp;&nbsp;</label>
                        <input type="checkbox" id="s2s_1" name="s2s_1" value="Y"> S2S
                        <label for="band_1">&nbsp;</label>
                        <select id="band_1" name="band_1">
                            <option value="2m">2m</option>
                            <option value="70cm">70cm</option>
                            <option value="6m">6m</option>
                            <option value="4m">4m</option>
                            <option value="23cm">23cm</option>
                            <option value="80m">80m</option>
                            <option value="60m">60m</option>
                            <option value="40m">40m</option>
                            <option value="30m">30m</option>
                            <option value="20m">20m</option>
                            <option value="17m">17m</option>
                            <option value="15m">15m</option>
                            <option value="12m">12m</option>
                            <option value="10m">10m</option>
                            <option value="13cm">13cm</option>
                            <option value="9cm">9cm</option>
                            <option value="6cm">6cm</option>
                            <option value="3cm">3cm</option>
                            <option value="160m">160m</option>
                            <option value="8m">8m</option>
                            <option value="5m">5m</option>
                            <option value="2190m">2190m</option>
                            <option value="630m">630m</option>
                            <option value="560m">560m</option>
                            <option value="1.25m">1.25m</option>
                            <option value="33cm">33cm</option>
                            <option value="1.25cm">1.25cm</option>
                            <option value="6mm">6mm</option>
                            <option value="4mm">4mm</option>
                            <option value="2.5mm">2.5mm</option>
                            <option value="2mm">2mm</option>
                            <option value="1mm">1mm</option>
                            <option value="submm">submm</option>
                        </select>
                        <label for="mode_1"></label>
                        <select id="mode_1" name="mode_1">
                            <option value="FM">FM</option>
                            <option value="SSB">SSB</option>
                            <option value="CW">CW</option>
                            <option value="FT8">FT8</option>
                            <option value="SSTV">SSTV</option>
                            <option value="MFSK">MFSK</option>
                            <option value="AM">AM</option>
                            <option value="ARDOP">ARDOP</option>
                            <option value="ATV">ATV</option>
                            <option value="CHIP">CHIP</option>
                            <option value="CLO">CLO</option>
                            <option value="CONTESTI">CONTESTI</option>
                            <option value="DIGITALVOICE">DIGITALVOICE</option>
                            <option value="DOMINO">DOMINO</option>
                            <option value="DYNAMIC">DYNAMIC</option>
                            <option value="FAX">FAX</option>
                            <option value="FSK441">FSK441</option>
                            <option value="FSK">FSK</option>
                            <option value="HELL">HELL</option>
                            <option value="ISCAT">ISCAT</option>
                            <option value="JT4">JT4</option>
                            <option value="JT6M">JT6M</option>
                            <option value="JT9">JT9</option>
                            <option value="JT44">JT44</option>
                            <option value="JT65">JT65</option>
                            <option value="MSK144">MSK144</option>
                            <option value="MTONE">MTONE</option>
                            <option value="MT63">MT63</option>
                            <option value="OLIVIA">OLIVIA</option>
                            <option value="OPERA">OPERA</option>
                            <option value="PAC">PAC</option>
                            <option value="PAX">PAX</option>
                            <option value="PKT">PKT</option>
                            <option value="PSK">PSK</option>
                            <option value="PSK2K">PSK2K</option>
                            <option value="Q15">Q15</option>
                            <option value="QRA64">QRA64</option>
                            <option value="ROS">ROS</option>
                            <option value="RTTY">RTTY</option>
                            <option value="RTTYM">RTTYM</option>
                            <option value="T10">T10</option>
                            <option value="THOR">THOR</option>
                            <option value="THRB">THRB</option>
                            <option value="TOR">TOR</option>
                            <option value="V4">V4</option>
                            <option value="VOI">VOI</option>
                            <option value="WINMOR">WINMOR</option>
                            <option value="WSPR">WSPR</option>
                        </select>
                    </td>
                </tr>

                <tr>
                    <td>Contact <? $cnt++;
                        echo $cnt; ?>:
                    </td>
                    <td>
                        <label for="contact_2"></label>
                        <input type="text" size="8" id="contact_2" name="contact_2">
                        <label for="s2s_2">&nbsp;&nbsp;</label>
                        <input type="checkbox" id="s2s_2" name="s2s_2" value="Y"> S2S
                        <label for="band_2">&nbsp;</label>
                        <select id="band_2" name="band_2">
                            <option value="2m">2m</option>
                            <option value="70cm">70cm</option>
                            <option value="6m">6m</option>
                            <option value="4m">4m</option>
                            <option value="23cm">23cm</option>
                            <option value="80m">80m</option>
                            <option value="60m">60m</option>
                            <option value="40m">40m</option>
                            <option value="30m">30m</option>
                            <option value="20m">20m</option>
                            <option value="17m">17m</option>
                            <option value="15m">15m</option>
                            <option value="12m">12m</option>
                            <option value="10m">10m</option>
                            <option value="13cm">13cm</option>
                            <option value="9cm">9cm</option>
                            <option value="6cm">6cm</option>
                            <option value="3cm">3cm</option>
                            <option value="160m">160m</option>
                            <option value="8m">8m</option>
                            <option value="5m">5m</option>
                            <option value="2190m">2190m</option>
                            <option value="630m">630m</option>
                            <option value="560m">560m</option>
                            <option value="1.25m">1.25m</option>
                            <option value="33cm">33cm</option>
                            <option value="1.25cm">1.25cm</option>
                            <option value="6mm">6mm</option>
                            <option value="4mm">4mm</option>
                            <option value="2.5mm">2.5mm</option>
                            <option value="2mm">2mm</option>
                            <option value="1mm">1mm</option>
                            <option value="submm">submm</option>
                        </select>
                        <label for="mode_2"></label>
                        <select id="mode_2" name="mode_2">
                            <option value="FM">FM</option>
                            <option value="SSB">SSB</option>
                            <option value="CW">CW</option>
                            <option value="FT8">FT8</option>
                            <option value="SSTV">SSTV</option>
                            <option value="MFSK">MFSK</option>
                            <option value="AM">AM</option>
                            <option value="ARDOP">ARDOP</option>
                            <option value="ATV">ATV</option>
                            <option value="CHIP">CHIP</option>
                            <option value="CLO">CLO</option>
                            <option value="CONTESTI">CONTESTI</option>
                            <option value="DIGITALVOICE">DIGITALVOICE</option>
                            <option value="DOMINO">DOMINO</option>
                            <option value="DYNAMIC">DYNAMIC</option>
                            <option value="FAX">FAX</option>
                            <option value="FSK441">FSK441</option>
                            <option value="FSK">FSK</option>
                            <option value="HELL">HELL</option>
                            <option value="ISCAT">ISCAT</option>
                            <option value="JT4">JT4</option>
                            <option value="JT6M">JT6M</option>
                            <option value="JT9">JT9</option>
                            <option value="JT44">JT44</option>
                            <option value="JT65">JT65</option>
                            <option value="MSK144">MSK144</option>
                            <option value="MTONE">MTONE</option>
                            <option value="MT63">MT63</option>
                            <option value="OLIVIA">OLIVIA</option>
                            <option value="OPERA">OPERA</option>
                            <option value="PAC">PAC</option>
                            <option value="PAX">PAX</option>
                            <option value="PKT">PKT</option>
                            <option value="PSK">PSK</option>
                            <option value="PSK2K">PSK2K</option>
                            <option value="Q15">Q15</option>
                            <option value="QRA64">QRA64</option>
                            <option value="ROS">ROS</option>
                            <option value="RTTY">RTTY</option>
                            <option value="RTTYM">RTTYM</option>
                            <option value="T10">T10</option>
                            <option value="THOR">THOR</option>
                            <option value="THRB">THRB</option>
                            <option value="TOR">TOR</option>
                            <option value="V4">V4</option>
                            <option value="VOI">VOI</option>
                            <option value="WINMOR">WINMOR</option>
                            <option value="WSPR">WSPR</option>
                        </select>
                    </td>
                </tr>

                <tr>
                    <td>Contact <? $cnt++;
                        echo $cnt; ?>:
                    </td>
                    <td>
                        <label for="contact_3"></label>
                        <input type="text" size="8" id="contact_3" name="contact_3">
                        <label for="s2s_3">&nbsp;&nbsp;</label>
                        <input type="checkbox" id="s2s_3" name="s2s_3" value="Y"> S2S
                        <label for="band_3">&nbsp;</label>
                        <select id="band_3" name="band_3">
                            <option value="2m">2m</option>
                            <option value="70cm">70cm</option>
                            <option value="6m">6m</option>
                            <option value="4m">4m</option>
                            <option value="23cm">23cm</option>
                            <option value="80m">80m</option>
                            <option value="60m">60m</option>
                            <option value="40m">40m</option>
                            <option value="30m">30m</option>
                            <option value="20m">20m</option>
                            <option value="17m">17m</option>
                            <option value="15m">15m</option>
                            <option value="12m">12m</option>
                            <option value="10m">10m</option>
                            <option value="13cm">13cm</option>
                            <option value="9cm">9cm</option>
                            <option value="6cm">6cm</option>
                            <option value="3cm">3cm</option>
                            <option value="160m">160m</option>
                            <option value="8m">8m</option>
                            <option value="5m">5m</option>
                            <option value="2190m">2190m</option>
                            <option value="630m">630m</option>
                            <option value="560m">560m</option>
                            <option value="1.25m">1.25m</option>
                            <option value="33cm">33cm</option>
                            <option value="1.25cm">1.25cm</option>
                            <option value="6mm">6mm</option>
                            <option value="4mm">4mm</option>
                            <option value="2.5mm">2.5mm</option>
                            <option value="2mm">2mm</option>
                            <option value="1mm">1mm</option>
                            <option value="submm">submm</option>
                        </select>
                        <label for="mode_3"></label>
                        <select id="mode_3" name="mode_3">
                            <option value="FM">FM</option>
                            <option value="SSB">SSB</option>
                            <option value="CW">CW</option>
                            <option value="FT8">FT8</option>
                            <option value="SSTV">SSTV</option>
                            <option value="MFSK">MFSK</option>
                            <option value="AM">AM</option>
                            <option value="ARDOP">ARDOP</option>
                            <option value="ATV">ATV</option>
                            <option value="CHIP">CHIP</option>
                            <option value="CLO">CLO</option>
                            <option value="CONTESTI">CONTESTI</option>
                            <option value="DIGITALVOICE">DIGITALVOICE</option>
                            <option value="DOMINO">DOMINO</option>
                            <option value="DYNAMIC">DYNAMIC</option>
                            <option value="FAX">FAX</option>
                            <option value="FSK441">FSK441</option>
                            <option value="FSK">FSK</option>
                            <option value="HELL">HELL</option>
                            <option value="ISCAT">ISCAT</option>
                            <option value="JT4">JT4</option>
                            <option value="JT6M">JT6M</option>
                            <option value="JT9">JT9</option>
                            <option value="JT44">JT44</option>
                            <option value="JT65">JT65</option>
                            <option value="MSK144">MSK144</option>
                            <option value="MTONE">MTONE</option>
                            <option value="MT63">MT63</option>
                            <option value="OLIVIA">OLIVIA</option>
                            <option value="OPERA">OPERA</option>
                            <option value="PAC">PAC</option>
                            <option value="PAX">PAX</option>
                            <option value="PKT">PKT</option>
                            <option value="PSK">PSK</option>
                            <option value="PSK2K">PSK2K</option>
                            <option value="Q15">Q15</option>
                            <option value="QRA64">QRA64</option>
                            <option value="ROS">ROS</option>
                            <option value="RTTY">RTTY</option>
                            <option value="RTTYM">RTTYM</option>
                            <option value="T10">T10</option>
                            <option value="THOR">THOR</option>
                            <option value="THRB">THRB</option>
                            <option value="TOR">TOR</option>
                            <option value="V4">V4</option>
                            <option value="VOI">VOI</option>
                            <option value="WINMOR">WINMOR</option>
                            <option value="WSPR">WSPR</option>
                        </select>
                    </td>
                </tr>

                <tr>
                    <td>Contact <? $cnt++;
                        echo $cnt; ?>:
                    </td>
                    <td>
                        <label for="contact_4"></label>
                        <input type="text" size="8" id="contact_4" name="contact_4">
                        <label for="s2s_4">&nbsp;&nbsp;</label>
                        <input type="checkbox" id="s2s_4" name="s2s_4" value="Y"> S2S
                        <label for="band_4">&nbsp;</label>
                        <select id="band_4" name="band_4">
                            <option value="2m">2m</option>
                            <option value="70cm">70cm</option>
                            <option value="6m">6m</option>
                            <option value="4m">4m</option>
                            <option value="23cm">23cm</option>
                            <option value="80m">80m</option>
                            <option value="60m">60m</option>
                            <option value="40m">40m</option>
                            <option value="30m">30m</option>
                            <option value="20m">20m</option>
                            <option value="17m">17m</option>
                            <option value="15m">15m</option>
                            <option value="12m">12m</option>
                            <option value="10m">10m</option>
                            <option value="13cm">13cm</option>
                            <option value="9cm">9cm</option>
                            <option value="6cm">6cm</option>
                            <option value="3cm">3cm</option>
                            <option value="160m">160m</option>
                            <option value="8m">8m</option>
                            <option value="5m">5m</option>
                            <option value="2190m">2190m</option>
                            <option value="630m">630m</option>
                            <option value="560m">560m</option>
                            <option value="1.25m">1.25m</option>
                            <option value="33cm">33cm</option>
                            <option value="1.25cm">1.25cm</option>
                            <option value="6mm">6mm</option>
                            <option value="4mm">4mm</option>
                            <option value="2.5mm">2.5mm</option>
                            <option value="2mm">2mm</option>
                            <option value="1mm">1mm</option>
                            <option value="submm">submm</option>
                        </select>
                        <label for="mode_4"></label>
                        <select id="mode_4" name="mode_4">
                            <option value="FM">FM</option>
                            <option value="SSB">SSB</option>
                            <option value="CW">CW</option>
                            <option value="FT8">FT8</option>
                            <option value="SSTV">SSTV</option>
                            <option value="MFSK">MFSK</option>
                            <option value="AM">AM</option>
                            <option value="ARDOP">ARDOP</option>
                            <option value="ATV">ATV</option>
                            <option value="CHIP">CHIP</option>
                            <option value="CLO">CLO</option>
                            <option value="CONTESTI">CONTESTI</option>
                            <option value="DIGITALVOICE">DIGITALVOICE</option>
                            <option value="DOMINO">DOMINO</option>
                            <option value="DYNAMIC">DYNAMIC</option>
                            <option value="FAX">FAX</option>
                            <option value="FSK441">FSK441</option>
                            <option value="FSK">FSK</option>
                            <option value="HELL">HELL</option>
                            <option value="ISCAT">ISCAT</option>
                            <option value="JT4">JT4</option>
                            <option value="JT6M">JT6M</option>
                            <option value="JT9">JT9</option>
                            <option value="JT44">JT44</option>
                            <option value="JT65">JT65</option>
                            <option value="MSK144">MSK144</option>
                            <option value="MTONE">MTONE</option>
                            <option value="MT63">MT63</option>
                            <option value="OLIVIA">OLIVIA</option>
                            <option value="OPERA">OPERA</option>
                            <option value="PAC">PAC</option>
                            <option value="PAX">PAX</option>
                            <option value="PKT">PKT</option>
                            <option value="PSK">PSK</option>
                            <option value="PSK2K">PSK2K</option>
                            <option value="Q15">Q15</option>
                            <option value="QRA64">QRA64</option>
                            <option value="ROS">ROS</option>
                            <option value="RTTY">RTTY</option>
                            <option value="RTTYM">RTTYM</option>
                            <option value="T10">T10</option>
                            <option value="THOR">THOR</option>
                            <option value="THRB">THRB</option>
                            <option value="TOR">TOR</option>
                            <option value="V4">V4</option>
                            <option value="VOI">VOI</option>
                            <option value="WINMOR">WINMOR</option>
                            <option value="WSPR">WSPR</option>
                        </select>
                    </td>
                </tr>

            </table>
            <p>
                <input type="submit" value="Submit">&nbsp;&nbsp;
                <button type="button" onclick="javascript:window.location='mm_home.html'">
                    Quit
                </button>
            </p>
            <input type="hidden" name="cnt" value="<?= $cnt ?>">
            <input type="hidden" name="vcnt" value="<?= $valid_cnt ?>">
        </form>
<?