const paths = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9.5V21h13V9.5', 'M10 21v-6h4v6'],
  cart: ['M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 8H6', 'M10 20a1 1 0 1 0 0 .01', 'M18 20a1 1 0 1 0 0 .01'],
  box: ['m12 3 9 5v8l-9 5-9-5V8l9-5Z', 'm3 8 9 5 9-5', 'M12 13v8'],
  truck: ['M3 6h11v9H3z', 'M14 10h4l3 3v2h-7z', 'M7 18a1.5 1.5 0 1 0 0 .01', 'M17 18a1.5 1.5 0 1 0 0 .01'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v6M14 11v6'],
  chart: ['M4 4v16h16', 'M8 16v-4M13 16V8M18 16V5'],
  clipboard: ['M8 4h8v3H8z', 'M7 6H5v15h14V6h-2', 'M9 12h6M9 16h4'],
  users: ['M9 8a3 3 0 1 0 0 .01', 'M3 21v-2a6 6 0 0 1 12 0v2', 'M16 5a3 3 0 0 1 0 6', 'M21 21v-2a6 6 0 0 0-4-5'],
  settings: ['M4 8h16M4 16h16', 'M9 8a2 2 0 1 0 0 .01', 'M15 16a2 2 0 1 0 0 .01'],
  book: ['M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z', 'M8 7h7M8 11h7'],
  graduation: ['m3 9 9-4 9 4-9 4-9-4Z', 'M7 11v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5'],
  calendar: ['M4 6h16v14H4z', 'M8 3v4M16 3v4', 'M4 11h16'],
  sparkles: ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z', 'M18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9L18 15Z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'm16.5 16.5 4 4'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['m5 13 4.5 4.5L19 7'],
  x: ['m6 6 12 12M18 6 6 18'],
  logout: ['M15 4h4v16h-4', 'M11 8l-4 4 4 4', 'M7 12h9'],
  alert: ['M12 4 2.8 20h18.4L12 4Z', 'M12 10v4M12 17v.01'],
  printer: ['M7 8V4h10v4', 'M5 8h14v8H5z', 'M8 16v5h8v-5'],
  clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'M12 8v4l3 2'],
  building: ['M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M16 9h3v12', 'M8 7h4M8 11h4M8 15h4'],
  shield: ['M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3Z', 'm9 12 2 2 4-4'],
  list: ['M8 6h13M8 12h13M8 18h13', 'M3.5 6h.01M3.5 12h.01M3.5 18h.01'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  mail: ['M3 6h18v12H3z', 'm3 7 9 6 9-6'],
  arrowRight: ['M5 12h13', 'm13 6 6 6-6 6'],
  star: ['m12 3 2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.4 6.4 20.2l1.2-6.2L3 9.7l6.2-.8L12 3Z'],
  refresh: ['M20 11a8 8 0 1 0-2.4 6.3', 'M20 5v6h-6'],
  download: ['M12 4v11', 'm8 11 4 4 4-4', 'M4 20h16'],
  filter: ['M4 6h16l-6 7v6l-4 2v-8L4 6Z'],
  phone: ['M7 3h10v18H7z', 'M11 18h2'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'],
  bookOpen: ['M12 6.5C10 5 7.5 4.5 4 5v13c3.5-.5 6 0 8 1.5', 'M12 6.5C14 5 16.5 4.5 20 5v13c-3.5-.5-6 0-8 1.5'],
}

export default function Icon({ name, size = 18, className, ...rest }) {
  const shape = paths[name] || paths.list
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {shape.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
