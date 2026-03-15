const email = 'mukeshmugi1114@gmail.com';
const url = 'http://localhost:3000/api/test-login';

async function test() {
  console.log(`Testing login for ${email}...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response body:', JSON.stringify(data, null, 2).slice(0, 500) + '...');
    
    const cookies = res.headers.getSetCookie();
    console.log('Cookies received:', cookies);
    
    if (res.ok) {
      console.log('SUCCESS: API returned 200 and session data.');
      if (cookies.length === 0) {
        console.warn('WARNING: No cookies set in response headers!');
      } else {
        const hasAuthCookie = cookies.some(c => c.includes('auth-token'));
        if (hasAuthCookie) {
          console.log('Verified: Auth token cookie is present.');
        } else {
          console.error('ERROR: Auth token cookie is MISSING from response!');
        }
      }
    } else {
      console.error('FAILURE: API returned error status.');
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  }
}

test();
