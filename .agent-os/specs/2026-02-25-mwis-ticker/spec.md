# Mountain Weather Information Service Ticker

The Mountain Weather Information Service publishes weather information for the Lake District and other regions.
The weather is published for the current day and subsequent two days.

There is a simple HTML view of the information here: https://www.mwis.org.uk/forecasts/english-and-welsh/lake-district/text
See [mwis-forecast-sample.txt](mwis-forecast-sample.txt) for a snapshot of the information available.

We need a 'ticker' or 'ticker tape' display to run across the top of the statistics panel, above the alerts and spots.
The ticker should be a single line and scroll a summary of the information provided for MWIS for the current day.

Features: present a compact summary of current mountain weather information including: 
 - Headline for the lake district,
 - wind speeds
 - precipitation
 - cloud
 - visibility
 - temperature

you should be able to read the full summary in 60 seconds, and the ticker should scroll continuously at a sensible
reading speed. Choose a nice font mimics an old fashioned teletype.

The data for the ticker can be cached but should be re-read every hour.

We will probably need to iterate on this a bit to get it looking smooth.
