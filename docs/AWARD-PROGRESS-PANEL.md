# Awards Progress Panel - new feature specification

This feature will allow a user to determine their progress towards one of the WOTA awards.
The panel should be displayed in the statistics panel, underneath the Activations/Chases statistics,
and be titled 'Award Progress'

There needs to be a toggle between 'Activator' and 'Chaser' that displays the data relating to the activator
and chaser awards specifically.

Each of the following awards should have a single horizonal bar graph, with the maximum value stated
as a number on the right hand side. The user's progress towards the award should be shown as a bar graph rising from left to right, 
with the numeric value shown in the bar. The bar graphs should align vertically.

The panel should be reactive and display well on desktop and mobile devices.

## The Books
As referenced in the database `summits` table, `book` column, with the following key/values:
    'E': 'Eastern Fells',
    'FE': 'Far Eastern Fells',
    'C': 'Central Fells',
    'S': 'Southern Fells',
    'N': 'Northern Fells',
    'NW': 'North Western Fells',
    'W': 'Western Fells',
    'OF': 'Outlying Fells'

### Database Tables

Use the following tables: for activator contacts the `activator_log`
and for chaser contacts the `chaser_log`. The books can be cross referenced
via the `wotaid` column in the log tables and the `summits` table `wotaid` column
where the `book` column indicates the applicable book for the summit.

For the `Lakeland 100` award the summits with references between LDW-001 to LDW-100
are considered (wotaid between 1 and 100 in the `summits` table).

SQL queries should look for DISTINCT `wotaid` and do not need to consider any date or 
year ranges.

### The Awards

The following progress bars should be displayed, one for each award:
 - All Wainwrights
 - Eastern Fells
 - Far Eastern Fells
 - Central Fells
 - Southern Fells
 - Northern Fells
 - North Western Fells
 - Western Fells
 - Outlying Fells
 - Lakeland 100

The Outlying fells bar graph should show the sub-categories of awards, based on the following
summits to qualify: Bronze (29), Silver (58), Gold (87), Platinum (116). You could do this by displaying
the bar graph with a transparent background matching the award colour.

Here is additional information about the awards:

## Awards for Chasers

Chasers may work towards claiming a total of thirteen all time unique Wainwrights On The Air awards

The Premier WOTA award for chasers is the Worked All Wainwrights Award. This certificate is awarded to 
chasers who have made contact with all 214 Wainwright summits. Summits are numbered in height order 
starting with LDW-001 Scafell Pike through to LDW-214 Castle Crag.

In addition, chasers may claim Worked All Wainwrights awards for completing contacts with all the
summits separately listed in each of the seven "Pictorial Guides to the Lakeland Fells," 
and the four levels of awards for the 116 "Outlying Fells of Lakeland." (See below).

## Awards for Activators
Activators have a total of fourteen awards to work towards.

### Wainwright Fell Walker Foundation Award
To encourage participation in the scheme you start to work towards the Wainwright Fell Walker Foundation Award.
This award is earned by activating any ten fells from the combined 214 main list and from the 116 outlying fells
list.

### Activated All Wainwrights Award
The premier WOTA award for activators is the Activated All Wainwrights Award. This certificate is awarded 
to radio amateurs who provide satisfactory evidence of having made qualifying activations from each of the
214 Wainwright summits.

### Activated All Book Wainwrights award
In addition, activators may claim Activated All Wainwrights awards for completing activations of all the summits in each
of the seven books and four levels of awards for the 116 "Outlying Fells of
Lakeland." (see below)

### Lakeland 100 Award
The Lakeland 100 Award is open to both Activators and Chasers. This certificate may be claimed by submitting 
evidence of completed contacts with or from all of the 100 highest mountains in the English Lake District
(LDW-001 to LDW-100). Retrospective contacts for the Lakeland 100 Award can be claimed as far back as 21st
March 2009 which is the date when WOTA officially started.

### The Outlying Fells of Lakeland Awards.
The Awards for completing the 116 Outlying Fells (known as Book 8) will be based on the number of fells
activated or chased. The certificates will be notated Bronze (29), Silver (58), Gold (87), Platinum (116). 
