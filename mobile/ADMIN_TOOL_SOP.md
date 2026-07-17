# Admin Tool SOP (Quick Start)

## Purpose
Use the Admin tool to manage:
- The Topic/Subtopic/Charge structure users browse.
- The YouTube videos users see for searches.

This is a practical control panel for content quality and search result quality.

## Before You Start
- Make sure you have the Admin access code.
- Confirm you are in the correct app environment (production vs local testing).
- Plan small, targeted changes and verify after each one.

## Where to Work
### 1) Index Mode
Use this mode for content structure updates.

You can:
- Edit existing Topic, Subtopic, and Charge fields.
- Add new index entries.

Use Index mode when the issue is naming, hierarchy, or missing entries.

### 2) YouTube Mode
Use this mode for video result quality.

You can:
- Refresh a query to replace cached YouTube results.
- Manage the channel whitelist.
- Enable/disable channels individually.
- Enable/disable all channels in bulk.
- Search within whitelist entries.

Use YouTube mode when the issue is which videos appear.

## Common Workflows
### Fix a typo or label issue
1. Open Admin.
2. Go to Index mode.
3. Find the item.
4. Edit Topic/Subtopic/Charge.
5. Save.
6. Verify in Search.

### Add a missing topic path
1. Open Admin.
2. Go to Index mode.
3. Add a new index entry.
4. Fill Topic/Subtopic/Charge.
5. Save.
6. Verify in Search.

### Replace stale YouTube results
1. Open Admin.
2. Go to YouTube mode.
3. Enter/select the target query.
4. Run refresh.
5. Re-check results in Search.

### Allow or block channels
1. Open Admin.
2. Go to YouTube mode.
3. In Whitelist, add/toggle channels.
4. Use bulk enable/disable only when needed.
5. Re-test search results.

## Fast Decision Rule
- If the problem is structure or wording, use Index mode.
- If the problem is returned videos, use YouTube mode.

## Operating Guidelines
- Make one change at a time.
- Verify behavior after each save.
- Prefer focused channel updates over broad bulk changes.
- Keep topic naming consistent across entries.

## Troubleshooting
### Access denied in Admin
- Access code is wrong or missing for the current app environment.

### Topics fail to load
- Usually API key or backend connectivity issue.

### Phone app behaves differently from local
- Device may be on an older build/update.
- Update app, force close, reopen, and retest.

## Change Log Template (Recommended)
When admins make changes, record:
- Date/time
- Person making change
- Area changed (Index or YouTube)
- What changed
- Why it changed
- Validation result
