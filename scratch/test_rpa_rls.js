const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://esfptwzoyrflmftfwsus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnB0d3pveXJmbG1mdGZ3c3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDI2MDUsImV4cCI6MjA2ODYxODYwNX0.O1nL13y0z19fE0Y96b7s30s4N6o994N463O_3791244';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRpaTable() {
  console.log('--- Testing rpa_pendencies SELECT with anon key ---');
  const { data, error } = await client.from('rpa_pendencies').select('*');
  if (error) {
    console.error('Error fetching rpa_pendencies:', error);
  } else {
    console.log('Success! Items count:', data ? data.length : 0);
    if (data && data.length > 0) {
      console.log('Sample item title:', data[0].title);
      console.log('Sample item history_notes:', data[0].history_notes);
    }
  }
}

testRpaTable();
