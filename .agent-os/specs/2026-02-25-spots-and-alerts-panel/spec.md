# Spots and Alerts Panel - New Feature

It would be convenient for users to be able to see the current spots and alerts lists in wota-data.
I'd like you to implement the new panel so that it is displayed where the current database statistics panel is.
That panel should be moved to the bottom of the statistics panel.

In the new Spots/Alerts panel there should be two columns. On the left is alerts, on the right is spots.
In each of the panels there should be a reverse chronological list the appropriate entries.

You can examine the wota-spotter application source code, in /Users/msw/code/wota-spotter to see the required database
queries and how each list should be formatted, and the rules around what to display.

For spots and alerts that originate from the logged in user there should be an option to delete them. This option should
also be available to administrators, regardless of the creator. There should be a confirmation dialog displayed if 
delete is requested, after which the entry can be removed from the database.

Any questions, let me know.
