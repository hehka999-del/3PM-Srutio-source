# Command Reference

## General

| Command | Purpose |
|---|---|
| `/help` | Show commands grouped by purpose. |
| `/ping` | Show WebSocket latency. |
| `/uptime` | Show process uptime. |
| `/server` | Show server overview. |
| `/user [user]` | Show a user profile. |
| `/avatar [user]` | Show a user's avatar. |
| `/language` or `/languages` | Open the per-user language selector. |

## Ranking & games

| Command | Purpose |
|---|---|
| `/rank [user] [color] [add_levels]` | Generate a PNG rank card. Administrators can add levels to a selected user. |
| `/top` | Open a public leaderboard with Experience, Messages and Levels buttons. |
| `/coinflip` | Flip a virtual coin. |
| `/rps` | Play Rock-Paper-Scissors with button selection. |
| `/tictactoe` | Start a button-based Tic-Tac-Toe game. |
| `/poll` | Create a timed poll with percentages and automatic results. |

## Support & content

| Command | Purpose |
|---|---|
| `/ticket` | Create a private support ticket after `/ticket-setup`. |
| `/ticket-setup` | Create the ticket category. |
| `/table` | Open the step-by-step table builder. |
| `/announcement` | Publish an announcement to the selected channel, or the current channel. |

## Moderation

| Command | Purpose |
|---|---|
| `/warn` | Issue a warning and record a case. |
| `/unwarn` | Remove the latest warning. |
| `/warnings` | View active warnings. |
| `/warnqueue` | Show users with 3/3 warnings. |
| `/cases` | Show recent cases. |
| `/mute` | Apply a Discord timeout. |
| `/unmute` | Remove timeout. |
| `/timeout` | Apply Discord timeout. |
| `/untimeout` | Remove Discord timeout. |
| `/kick` | Kick a member. |
| `/ban` | Ban a member. |
| `/clear` | Bulk delete recent messages. |
| `/lock` / `/unlock` | Toggle Send Messages in the current channel. |
| `/slowmode` | Set channel slowmode. |

## Administration

| Command | Purpose |
|---|---|
| `/setup` | Create basic system roles and check hierarchy. |
| `/settings` | Show stored server settings. |
| `/logs` | Set or disable the log channel. |
| `/automod` | Toggle AutoMod and individual rules. |
| `/filter` | Manage bad words and filtering. |
| `/botguard` | Toggle removal of new bots. |
| `/roles` | List/create/delete/give/remove/rename roles. |
| `/temprole` | Give a role temporarily. |
| `/stats-setup` | Create public statistics voice channels. |
| `/panel` | Open the administration control center. |
| `/ai` | Open the AI entry point and status view. |

## Permissions

Dangerous actions always check both Discord permissions and role hierarchy. The bot cannot move its own role above other roles automatically; this must be done in Discord Server Settings → Roles.
