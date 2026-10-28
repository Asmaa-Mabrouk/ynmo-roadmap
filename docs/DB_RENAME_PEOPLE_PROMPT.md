# Prompt for the database agent: rename the team to the official names

Project: Supabase YNMO_PM (ref `avgkenwdehtwynrswsck`). Every table is a generic document table `{id text, data jsonb}`. Work carefully: this changes live data. Do not print or ask for passwords or keys.

## Step 0: back up first (read-only)
Export every table that holds app documents (people, roadmap/feature overrides, vacations, sprint_items, sprints, ideas, reports, activity) to a dated copy, for example `create table backup_20261028_<table> as select * from <table>`. Tell me the names of the backup tables.

## The mapping (exact string match on a whole JSON value or a whole JSON key; never replace parts of words)
| Old value(s) found in the data | New official name |
|---|---|
| Altramsi, Tramsi, Mohamed Altramsi | Mohamed Altramsi |
| Aliaa | Aliaa Ibrahim |
| Shady, Sahdy | Shady Bassily |
| Amal | Amal Saleem |
| Sayeh | Mo'men Sayeh |
| Abdelhamid | Abdelhamid Ali |
| Aya Fathy | Aya Fathy (no change) |
| Adnan | Ahmed Adnan |
| Soliman | Ahmed Soliman |
| Wardany, Waradny | Ahmed Wardany |
| Hamid, Hamid Shahin | Hamid Shahien |
| Hosieny, Hoseiny | Ahmed Hoseiny |
| Saad | Saad Mohamed |
| Khalid, Khalid Abdelfattah | Khalid Abdelfattah |
| Mona | Mona Mohamed |
| Dina Mousa | Dina Mousa (no change, a different person from Dina Samy) |
| Dina Sam, Samy, Dina Samy | Dina Samy |
| Zahran | Mohamed Zahran |

Do NOT touch any other person (Emad, Asmaa, Engy, Mario, Sherif, Mwrohan, Mostafa, Merihan, and so on). Do not rename inside titles, notes or free text; only in the fields below.

## Step 1: dry run (read-only). Report counts per table and per field before changing anything
Search these places for the old values:
1. `people/<id>`: field `n` (the name) on every doc, including docs with `hidden: true` and `over: true`.
2. Feature overrides (the doc that stores per-feature changes): the array `res` (names), and the object `pd` whose KEYS are names.
3. `vacations/<id>`: field `p`.
4. `sprint_items/<id>`: field `t` when `k = 'p'`, and field `person` when there is no `k`.
5. `ideas/<id>`:
   - timeline notes (`tn: true`): field `p`
   - `peopleorder`: array `ord`
   - `peoplehide`: object `byRm` whose values are arrays of names
   - `capacity`: `lanes[].people` (array of names) and `leaving` (object whose KEYS are names)
6. Monthly docs `reports/mo<yyyymm>` and `reports/mobacklog` and all history copies `reports/mohist…`: each card's `who` = `{track: {name: points}}`, where the names are KEYS. History copies hold the card list inside field `doc`, so look inside `doc` too.
7. Any other jsonb value that equals an old name exactly (search `data::text` for each old name in double quotes, list the paths, and show me anything not covered above before touching it).

## Step 2: collisions. Stop and report instead of guessing
If one object ends up with two keys that map to the same new name (for example `who.be` having both `Wardany` and `Waradny`, or `pd` having both `Dina Sam` and `Samy`), do not overwrite. List the card or feature id and both values, and I will decide. For arrays, drop the duplicate after renaming (keep one copy).

## Step 3: apply (only after I approve the dry run)
Do it inside one transaction per table. Keep every other field untouched, including ids, `status`, timestamps and `hist` fields. After each table, re-run the dry-run search and show that zero old values remain.

## Step 4: people list
After renaming, the `people/*` docs must contain one visible doc per official name (no two visible docs with the same `n`). If two visible docs now have the same name, keep the older one visible and set `hidden: true` on the other (do not delete: editors cannot delete there). List what you changed.

## Step 5: report
Give me: backup table names, number of rows and fields changed per table, collisions found, and the final list of visible names per track. Do not change any schema, policy, function or setting.

Important for me: the app code still has the old short names as built-in starting names. Run this AFTER the code that uses the official names is deployed, otherwise the old names come back as extra rows.
