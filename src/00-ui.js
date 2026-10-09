//@ the UI the editor saved: HUD chips, panels, the start screen chips, the pause line and the guide, as data over the kit. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.
  CO.ui({
    "hud": [
      {
        "label": "Day",
        "value": "S.day"
      },
      {
        "label": "Time",
        "value": "fmtTime(S.time)"
      },
      {
        "label": "Bank",
        "value": "money(S.bank)",
        "color": "#f5b53d"
      },
      {
        "label": "Rep",
        "value": "S.rep"
      },
      {
        "label": "Level",
        "value": "S.level"
      },
      {
        "label": "Job",
        "value": "S.job ? ({ coming: 'car on its way', waiting: 'customer at the desk', taken: 'find the fault', fixing: 'fixing', done: 'fixed, take the money', paid: 'paid', leaving: 'leaving' })[S.job.state] || S.job.state : 'no job'"
      },
      {
        "label": "Roll door",
        "value": "S.doorOpen ? 'open' : 'closed'"
      }
    ],
    "panels": {},
    "start": [
      "'Day ' + S.day",
      "money(S.bank)",
      "S.stats.jobs + ' jobs done'"
    ],
    "menuLine": "'Day ' + S.day + ' at the lock-up · ' + money(S.bank) + ' in the bank'",
    "guide": ""
  });
