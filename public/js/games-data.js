const GAMES_DATA = [
  {
    id: "one-hook",
    title: "One Hook",
    badge: "NEW",
    subtitle: "Drop the hook, catch fish, and go deeper!",
    description: "Drop the hook with tap, click, or Spacebar, catch the fish, and go deeper. How big can your catch get?",
    image: "/assets/one_hook_cover.jpg",
    route: "/games/one-hook",
    isPlayable: true,
    stats: {
      topScore: "0",
      players: "1 Player",
      challengesCount: 3
    },
    challenges: [
      {
        id: "ch-1",
        title: "Catch 20 Fish",
        desc: "Catch any 20 fish in a single run",
        icon: "🐟",
        iconBg: "#0284c7",
        progress: 0,
        max: 20
      },
      {
        id: "ch-2",
        title: "Reach 500m Depth",
        desc: "Go 500 meters deep (Level 4 Twilight)",
        icon: "⚓",
        iconBg: "#059669",
        progress: 0,
        max: 500
      },
      {
        id: "ch-3",
        title: "Perfect Catch x10",
        desc: "Get 10 combo catches",
        icon: "⭐",
        iconBg: "#7c3aed",
        progress: 0,
        max: 10
      }
    ]
  },
  {
    id: "star-quest",
    title: "Star Quest",
    badge: "NEW",
    subtitle: "Cheer on your kids! Give daily stars for achievements.",
    description: "Cheer on your kids! Give daily stars for achievements and unlock secret rewards together.",
    image: "/assets/star_quest_cover.svg",
    route: "/star-quest",
    isPlayable: true,
    stats: {
      topScore: "-",
      players: "Family",
      challengesCount: 0
    },
    challenges: []
  },
  {
    id: "deep-sea-abyss",
    title: "Deep Sea Abyss",
    badge: "COMING SOON",
    subtitle: "Explore dark trenches and evade ancient predators!",
    description: "Explore dark oceanic trenches, evade bioluminescent predators, and claim sunken treasure.",
    image: "/assets/abyss_diver_cover.jpg",
    route: "/games/deep-sea-abyss",
    isPlayable: false,
    stats: {
      topScore: "--",
      players: "Coming Soon",
      challengesCount: 0
    },
    challenges: []
  }
];

window.GAMES_DATA = GAMES_DATA;
