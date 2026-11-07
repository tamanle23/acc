import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  let email = '';
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = await request.json();
      email = data.email || '';
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    try {
      const formData = await request.formData();
      email = (formData.get('email') as string) || '';
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid form data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Please provide a valid email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simulated or external provider integration (buttondown/mailchimp)
  if (!contentType.includes('application/json')) {
    return redirect('/?subscribed=true');
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Subscription successful',
      email,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ status: 'ok', endpoint: '/api/newsletter' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
