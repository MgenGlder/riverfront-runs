// Single source of truth for event details & links.
// Update the event URL here when a new Meetup event is created.
export const MEETUP_GROUP_URL = 'https://www.meetup.com/meetup-group-frisqziq/'
export const NEXT_EVENT_URL = 'https://www.meetup.com/meetup-group-frisqziq/events/315575219'

// Live map defaults — centered on the Renaissance Center / Detroit Riverfront.
export const MAP = {
  center: [42.3294, -83.0396],
  zoom: 15,
}

export const EVENT = {
  day: 'Every Sunday',
  time: '2:00 PM',
  location: 'Detroit Riverfront',
  landmark: 'In front of the Ren Cen',
  organizers: ['Kunle', 'Varun'],
}

export const DETAILS = [
  {
    icon: '🗓️',
    title: 'Every Sunday',
    lead: '2:00 PM',
    text: "Rain or shine energy. Show up and we'll get moving together.",
  },
  {
    icon: '📍',
    title: 'Detroit Riverfront',
    lead: 'In front of the Ren Cen',
    text: 'Right on the river. Big views. Good energy.',
  },
  {
    icon: '🏃',
    title: 'All Paces Welcome',
    lead: 'Walk, jog, or run',
    text: 'No one gets left behind. You belong here.',
  },
  {
    icon: '🤝',
    title: 'Community',
    lead: 'Stronger together',
    text: 'Good vibes. Great people. Come make some friends.',
  },
]

export const FAQS = [
  {
    q: 'Do I need to be a fast runner?',
    a: 'Not at all. All paces are welcome — walk, jog, or run. The whole point is showing up and moving together.',
  },
  {
    q: 'Where exactly do we meet?',
    a: 'On the Detroit Riverfront, right in front of the Renaissance Center (Ren Cen). Look for the group near the water.',
  },
  {
    q: 'How much does it cost?',
    a: "Nothing. It's a free community run every single Sunday.",
  },
  {
    q: 'What should I bring?',
    a: 'Comfortable shoes, water, and a good attitude. Dress for the weather — we run rain or shine.',
  },
]
