//@ the NPCs the editor saved: characters and what they do, their spawners, the workers and the spots they go to, as data. Written by the Co Engine editor; it sorts first in src/. Edit it in the editor rather than here.
  CO.npcs({
    "characters": {
      "customer": {
        "names": [
          "Sam",
          "Alex",
          "Jo",
          "Robin"
        ],
        "look": {
          "shirt": "#c0392b",
          "pants": "#2c3e50"
        },
        "speed": 1.5,
        "car": true,
        "steps": [
          {
            "do": "walk",
            "to": "desk"
          },
          {
            "do": "say",
            "text": "Hi there!"
          },
          {
            "do": "talk",
            "prompt": "Talk to {name}",
            "text": "Can you help me today?",
            "choices": [
              {
                "label": "Of course",
                "say": "Thanks!",
                "run": "cash 25"
              },
              {
                "label": "Not now",
                "say": "Another time, then.",
                "then": "leave"
              }
            ]
          },
          {
            "do": "wait",
            "seconds": 2
          },
          {
            "do": "say",
            "text": "Bye!"
          },
          {
            "do": "leave"
          }
        ]
      },
      "clerk": {
        "names": [
          "Kim"
        ],
        "look": {
          "shirt": "#27ae60",
          "pants": "#34495e",
          "style": "cap"
        },
        "speed": 1.3,
        "steps": [
          {
            "do": "say",
            "text": "Welcome in!"
          },
          {
            "do": "wait",
            "seconds": 6
          },
          {
            "do": "wander",
            "radius": 1.5,
            "seconds": 5
          },
          {
            "do": "walk",
            "to": "post"
          },
          {
            "do": "repeat"
          }
        ]
      }
    },
    "spawners": [
      {
        "id": "road",
        "character": "customer",
        "x": -30.3,
        "z": 20.6,
        "park": [
          -6.3,
          15.6
        ],
        "every": 40,
        "max": 1
      }
    ],
    "workers": [
      {
        "id": "clerk",
        "character": "clerk",
        "x": 1.2,
        "z": 8.1,
        "ry": 0
      }
    ],
    "spots": {
      "desk": {
        "x": -0.3,
        "z": 10.6,
        "ry": 3.14
      }
    }
  });
