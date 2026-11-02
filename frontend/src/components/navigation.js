export const navGroups = [
  {
    title: 'Daily work',
    items: [
      { to: '/home', label: 'Home', icon: 'home', permission: 'home.view' },
      { to: '/', label: 'Ordering', icon: 'cart', permission: 'orders.view', end: true },
      { to: '/cart', label: 'Cart', icon: 'box', permission: 'orders.view' },
      { to: '/stock-count', label: 'Stock count', icon: 'clipboard', permission: 'counts.view' },
      { to: '/sales', label: 'Sales', icon: 'chart', permission: 'sales.view' },
      { to: '/reporting', label: 'Reporting', icon: 'chart', permission: 'reporting.view' },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/rostering', label: 'Rostering', icon: 'calendar', permission: 'rostering.view' },
      { to: '/communications', label: 'Comms', icon: 'mail', permission: 'comms.view' },
      { to: '/ops-management', label: 'Checklists', icon: 'check', permission: 'ops.view' },
      { to: '/learning-centre', label: 'Learning', icon: 'graduation', permission: 'learning.view' },
      { to: '/knowledge-library', label: 'Library', icon: 'book', permission: 'knowledge.view' },
      { to: '/employment-documents', label: 'Documents', icon: 'shield', permission: 'users.manage' },
    ],
  },
  {
    title: 'Stock',
    items: [
      { to: '/stock-transfers', label: 'Transfers', icon: 'truck', permission: 'transfers.view' },
      { to: '/wastage', label: 'Wastage', icon: 'trash', permission: 'counts.view' },
      { to: '/labels', label: 'Labels', icon: 'printer', permission: 'prep.view' },
      { to: '/admin', label: 'Suppliers & stock', icon: 'box', permission: 'stock.manage', end: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/accounts', label: 'Accounts', icon: 'users', permission: 'users.manage' },
      { to: '/admin/settings', label: 'App settings', icon: 'settings', permission: 'appearance.manage' },
      { to: '/settings', label: 'Settings', icon: 'settings', end: true },
      { to: '/settings/awards', label: 'Awards', icon: 'star', permission: 'awards.manage' },
      { to: '/settings/devices', label: 'Kiosk devices', icon: 'phone', permission: 'devices.manage' },
      { to: '/help', label: 'Help & support', icon: 'bookOpen' },
    ],
  },
]

export const titleFor = (pathname) => {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.to === pathname) return item.label
    }
  }
  if (pathname.startsWith('/admin/')) return 'Administration'
  return 'Opstack'
}
