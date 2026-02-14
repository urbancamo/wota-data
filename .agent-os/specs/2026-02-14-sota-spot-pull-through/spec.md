# SOTA to WOTA spots pull through

## Overview

The SOTA 'Summits on the Air' Amateur Radio program has a spot facility, where activators can indicate what summit
they are on and the frequencies they are currently using. 

The WOTA 'Wainwrights on the Air' Amateur Radio program covers all the Wainwright summits in the Lake District.
Some WOTA summits are also SOTA summits. When someone doing SOTA posts a spot we want to record that in the `Spot` table
with the equivalent WOTA ID so that our spotter application, and other sinks of that data, can use it to inform WOTA
programmer users.

## Existing Functionality

This feature is currently implemented in Golang as a custom CGI script that runs on the same server as the legacy
website `wota.org.uk`. The source code for this application is located in the `wota` GoLang project stored 
under `/Users/msw/code/wota/sotaspots`. 

## High Level Requirement
We want to replace this facility with a more modern version running in this project,
so it is more maintainable and less of a hack, moving forward.

## Details of the Existing Implementation

The `sotaspots/getspots.go` file implements the functionality that we need to duplicate in this project in TypeScript.
It is fired by an external cron job that runs every minute. We will need to build this functionality and the cron
firing into the wota-data application. It adds records to the spots table, see schema.prisma for the `Spot` table
definition. 

The `sotautils/sotawota.go` source file in the `wota` project contains utilities to convert from SOTA summits references
to WOTA summit references. You have routines to do that already in this project, and the `summits` table contains the 
mapping between `sota` references and `wotaid`s.

The main method in `sotaspots/getspots.go` is run each time the cron job is fired.
It connects to the database then calls the `getSpots` method. This fetches data from the SOTA API end point 
`http://api2.sota.org.uk/api/spots/1` to collect SOTA spots. The `convertSotaToWotaSpots` then converts any 
spots that have a corresponding WOTA id, and then the `updateSpotsInDb` method stores the converted spot in to our `Spot`
table. Other applications such as the `wota-spotter` application then use this data to display the latest spots.

## Plan

Write a plan to implement this feature. Use the most appropriate mechanism for running the equivalent of the `main` method,
either by using a cron library or having a continuous main loop with a delay.

### Enhancements 
One feature that will also be required is the ability to remove spots in the WOTA `Spot` table that have been created
from a SOTA spot, if the original SOTA spot is deleted. The current GoLang implementation doesn't do this.

## Implementation

I will create a branch for this functionality. Once the plan in written and agreed implement the existing functionality,
with the specified enhancements.