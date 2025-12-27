| activator_log Column | ADIF Source Field(s)             | Transformation                             | Max Length | Notes                                                                     |
  |----------------------|----------------------------------|--------------------------------------------|------------|---------------------------------------------------------------------------|
| activatedby          | ~~OPERATOR or STATION_CALLSIGN~~ | Uses authenticated user's session username | 11 chars   | Changed recently - now set from req.session.username instead of ADIF file |
| callused             | STATION_CALLSIGN or OPERATOR     | Strips /P or /M suffix, truncated          | 8 chars    | Priority: STATION_CALLSIGN first, fallback to OPERATOR                    |
| wotaid               | SIG_INFO or MY_SIG_INFO          | Extracts numeric WOTA ID                   | integer    | Extracts numbers from formats like "LDW-001", "001", "1"                  |
| date                 | QSO_DATE                         | Parses YYYYMMDD to Date                    | Date       | Required field                                                            |
| time                 | TIME_ON                          | Parses HHMMSS or HHMM to Date              | Date       | Optional - can be null                                                    |
| year                 | QSO_DATE                         | Extracted from parsed date                 | integer    | Derived from date field                                                   |
| stncall              | CALL                             | Direct mapping, truncated                  | 12 chars   | Station called (required)                                                 |
| ucall                | CALL                             | Direct mapping, truncated                  | 8 chars    | Shortened version of CALL                                                 |
| rpt                  | ~~RST_SENT~~                     | Always null                                | integer    | Changed recently - always set to null regardless of ADIF data             |
| s2s                  | SIG + SIG_INFO                   | 1 if SIG="WOTA" and SIG_INFO exists        | integer    | Summit-to-Summit indicator                                                |
| confirmed            | -                                | Always undefined                           | integer    | Not populated from ADIF                                                   |
| band                 | BAND                             | Direct mapping, truncated                  | 8 chars    | e.g., "40m", "2m"                                                         |
| frequency            | FREQ                             | Parsed as float                            | float      | In MHz                                                                    |
| mode                 | MODE                             | Direct mapping, truncated                  | 32 chars   | e.g., "SSB", "CW", "FM"                                                   |

