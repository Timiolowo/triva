The problem is that Dulo is too heavy for your Hisense Q6Q’s VIDAA browser, and the browser can become slow or close even before you press Play.

The strongest evidence is that the issue happens before video playback starts. That means the movie stream itself is not the only problem. The frontend is already doing too much work: loading JavaScript, many API calls, images, UI components, player code, and other browser-side logic. Your HAR capture showed substantial activity before playback, including many TMDB requests and large amounts of artwork and JavaScript.

So the main reason is likely this:

Dulo frontend
    ↓
Too many requests
Too many images
Heavy JavaScript
Large DOM/UI
Player initialized early
Extra scripts
    ↓
VIDAA browser has limited resources
    ↓
Lag / memory pressure
    ↓
Browser closes

The solution is not to load the full Dulo website at all. Instead, build a very small TV-focused website hosted on Vercel that contains only the functions you actually need.

You said you do not care about posters, recommendations, cast, trailers, or a Netflix-style interface. That simplifies the project dramatically.

The ideal interface could literally be:

MOVIES
Search
[ Interstellar____________ ]
Results
Interstellar (2014)
Interstellar: Beyond Time (2020)
             ↓ OK
Interstellar (2014)
[ PLAY ]

Then:

FULL-SCREEN VIDEO

For TV shows:

Breaking Bad
Season 1
Season 2
Season 3
Season 4
Season 5
        ↓
Season 2
Episode 1
Episode 2
Episode 3
Episode 4
        ↓
PLAY

Architecture

The overall architecture should be:

                     HISENSE Q6Q
                         │
                         │ VIDAA browser
                         ▼
                YOUR VERCEL WEBSITE
                         │
              Very lightweight frontend
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
      METADATA                     PLAYBACK
          │                             │
          │                             │
        TMDB                   Authorized video
          │                      source/provider
          │                             │
          ▼                             ▼
     Search/title                  HLS / MP4
     year/type                          │
     seasons                            ▼
     episodes                     HTML5 player

TMDB handles only:

Search
Movie titles
Years
Movie/TV IDs
Seasons
Episodes

You don’t even need to request posters.

Your frontend therefore becomes extremely small:

Vercel App
│
├── /
│   └── Search
│
├── /movie/[id]
│   └── Play
│
├── /tv/[id]
│   ├── Seasons
│   └── Episodes
│
└── /watch/[id]
    └── Video player

And internally:

src/
│
├── search.js
├── tmdb.js
├── remote.js
├── player.js
└── styles.css

You may not even need Next.js. Plain HTML, CSS and JavaScript could actually be preferable for this TV, because the goal is minimum browser workload.

The remote-control logic is also simple:

↑ ↓
navigate results
← →
navigate seasons
OK
select / play
BACK
return

What we deliberately remove

Your version should not load:

Posters
Backdrop images
Cast photos
Recommendations
Similar movies
Trailers
Animations
Infinite scrolling
Autoplay previews
Analytics
Large UI libraries
Complex page transitions
Background videos
Unnecessary fonts

The initial page could essentially be:

HTML
+
CSS
+
small JavaScript
+
one API request when you search

That is dramatically different from loading the complete Dulo frontend.

The one remaining problem

There are really two independent systems:

1. FIND THE MOVIE
TMDB
✓ straightforward
2. PLAY THE MOVIE
Actual video source
← this is the remaining issue

So the project in one sentence is:

Build a text-only, remote-controlled Vercel TV frontend that uses TMDB only for search/title/episode identification, loads almost nothing until required, and sends the selected authorized stream directly to a minimal full-screen video player.

That architecture directly targets the part that appears to be overwhelming your Q6Q before playback even begins.