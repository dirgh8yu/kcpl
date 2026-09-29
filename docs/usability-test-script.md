# Usability test script

Two short sessions, one with a KCPL staff member and one with a customer.
Watching them is the fastest way to find out what the screens still get
wrong. Each session takes about 30 minutes and needs one observer. Keep the
recording or notes private.

## Before you start

- Use a real job the person is already working on. If that isn't possible,
  use the QA preview (`docs/qa-preview-setup.md`). Don't use the public site.
- Sit beside or behind them. Say this first: *"We're testing the system, not
  you. Think out loud. If something is confusing, that's what we want to hear."*
- **Don't help.** If they're stuck for 60 seconds, note where, then tell
  them the next step and move on.
- For every task, write down:
  - where they looked first;
  - any wrong click;
  - any word they didn't understand;
  - how long the task took.

## Session A: staff (desktop, then the KCPL Ops app)

Choose a job that is not delivered yet and has at least one open item, such
as a missing document or a pickup not yet booked.

| # | Task (read it aloud) | What to watch | It passes if |
| --- | --- | --- | --- |
| 1 | "Open the system and show me what you'd work on first today." | Do they use Overview's next actions or go straight to Shipments? Do they find **Assigned to me**? | They reach one of their own jobs in under 30 s. |
| 2 | "Open job ___. What has to happen next?" | Do they read the highlighted step in the Job File checklist, or scroll? | They say the next step without clicking around. |
| 3 | "Book the pickup for tomorrow 10–1." | Do they find the Pickup step, then its form? Do they look for a separate Pickups page? | Booked without leaving the Job File. |
| 4 | "The truck left. Tell the customer." | Do they use **Post update** under "Where it is", or look for a status dropdown? | The update is published and they can say where the customer will see it. |
| 5 | "Try to mark it delivered." (Do this while proof of delivery is still missing.) | Do they understand the blocker panel? Do they use its fix link? | They can say why it's blocked and what would unblock it. |
| 6 | "Give these three jobs to a colleague." | Do they find the tick boxes and the bulk bar on Shipments? | All three reassigned in one action. |
| 7 | On the phone (KCPL Ops): "Find the same job and tell me what's next." | Do they read the "Next:" or "Stuck:" line? | Same answer as task 2. |
| 8 | On the phone: "Add a note and a photo for the office." | Can they find the note and camera actions? | The note appears on the desktop Job File. |

Ask at the end:
- "Which screen did you trust least? Why?"
- "Is there anything you still do on paper or WhatsApp that you'd expect to
  do here?"
- "Which word on the screen would you change?"

## Session B: customer (portal on a phone or laptop, then the KCPL app)

Use a customer who has one of these waiting on them: a document to send, an
invoice to pay, or a quote to answer.

| # | Task (read it aloud) | What to watch | It passes if |
| --- | --- | --- | --- |
| 1 | "Sign in. Is there anything KCPL needs from you?" | Do they see **What KCPL needs from you** at the top? Do they read it all? | They name every item without scrolling past it. |
| 2 | "Send the document they're asking for." | Can they get from the list to the upload? Do they know the file went? | Upload finished, and they saw the confirmation. |
| 3 | "Where is your shipment right now, and when will it arrive?" | Timeline, map or status. Which one do they read? | They give the location and ETA correctly. |
| 4 | "Do you owe KCPL anything? Show me how you'd pay." | Invoices, balance, overdue label. | They find the right invoice and the pay option. They don't need to finish paying. |
| 5 | "You got a price from KCPL. Accept it." (Only if a quote is waiting.) | Do they open it from the needs list or hunt for it? | Reached the accept button. |
| 6 | In the KCPL app: "Same question. Does KCPL need anything from you?" | Home sheet, **What KCPL needs from you**. | Same answer as task 1. |

Ask at the end:
- "What would make you call KCPL instead of using this?"
- "Was anything written in a way you didn't understand?" If they use Nepali,
  run the same tasks in Nepali.

## After the sessions

1. List every problem once, with how many people hit it.
2. Mark each problem:
   - **Blocks:** they couldn't finish the task.
   - **Slows:** they finished, but hesitated or clicked wrong.
   - **Words:** they misread a label.
3. Fix Blocks first. Words are usually the cheapest fixes, so batch them.
4. Run the same tasks again after the fixes. A task passes when two people in
   a row finish it without help.
