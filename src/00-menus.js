//@ the menus the editor saved: the start screen, the pause menu, the settings and their pages, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.
  CO.menus({
    "theme": {
      "accent": "#f5b53d",
      "panel": "#121a24",
      "text": "#eef1f5",
      "muted": "#a0acb8"
    },
    "start": {
      "title": "Garage Co.",
      "subtitle": "",
      "buttons": [
        {
          "label": "Play",
          "action": "play",
          "primary": true
        },
        {
          "label": "Settings",
          "action": "settings"
        },
        {
          "label": "How to play",
          "action": "guide"
        },
        {
          "label": "Save slots",
          "action": "slots"
        },
        {
          "label": "Quit",
          "action": "quit"
        }
      ]
    },
    "pause": {
      "title": "Paused",
      "buttons": [
        {
          "label": "Resume",
          "action": "resume",
          "primary": true
        },
        {
          "label": "Settings",
          "action": "settings"
        },
        {
          "label": "How to play",
          "action": "guide"
        },
        {
          "label": "Build mode",
          "action": "edit"
        },
        {
          "label": "The books",
          "action": "stats"
        },
        {
          "label": "Save file",
          "action": "saves"
        },
        {
          "label": "Unlink the editor",
          "action": "devlink"
        },
        {
          "label": "⟲ Reset this save",
          "action": "reset"
        },
        {
          "label": "Quit to the start",
          "action": "quit"
        }
      ]
    },
    "settings": {
      "hide": [],
      "custom": []
    }
  });
