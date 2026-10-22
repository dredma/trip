// Public by design: the Supabase project URL and its anon (public) key. They
// only allow what row-level security permits; the trip page uses neither
// tables nor RPCs directly, only the Edge Function `trip`.
window.TRIP_CONFIG = {
  functionUrl: "https://vtjtiyypfjjgbakziyjs.supabase.co/functions/v1/trip",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0anRpeXlwZmpqZ2Jha3ppeWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjkwNjUsImV4cCI6MjEwNzg0NTA2NX0.09OIPG-TKQfH9YIsdx2_TpxErDWVruDlBg1Nyj1rB-E",
  refreshSeconds: 180,
};
