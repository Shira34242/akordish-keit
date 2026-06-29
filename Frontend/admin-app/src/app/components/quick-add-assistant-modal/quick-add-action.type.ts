export type QuickAddAction =
  | 'index-teacher'
  | 'index-service-provider'
  | 'index-service-provider-general'
  | `index-service-provider-category:${number}`
  | 'artist-account'
  | 'artist-community'
  | 'contact'
  | 'chord-requests'
  | 'admin-edit';
