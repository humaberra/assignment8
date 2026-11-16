// app.js — browser code for the Web Craft Academy information page.
// Calls the API with relative URLs, so the page only works when it is
// served by our own Express server (same origin).

const statusElement = document.querySelector('#status');
const outputElement = document.querySelector('#output');
const buttons = document.querySelectorAll('button[data-path]');

// Read the body in the right way: JSON is pretty-printed with 2-space
// indentation, everything else is shown as plain text.
async function readBody(response) {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    return JSON.stringify(data, null, 2);
  }

  return response.text();
}

function statusClass(status) {
  if (status >= 200 && status < 300) {
    return 'success';
  }
  if (status >= 300 && status < 400) {
    return 'redirect';
  }
  return 'error';
}

function showResult(statusText, cssClass, bodyText) {
  statusElement.textContent = statusText;
  statusElement.className = `status ${cssClass}`;
  outputElement.textContent = bodyText;
}

async function callRoute(method, path) {
  showResult(`Sending ${method} ${path} ...`, '', '');

  try {
    const response = await fetch(path, { method });
    const body = await readBody(response);

    const lines = [
      `${method} ${path}`,
      `Status: ${response.status} ${response.statusText}`,
      `Content-Type: ${response.headers.get('Content-Type') ?? '(none)'}`,
    ];

    // fetch follows redirects automatically; show where we ended up.
    if (response.redirected) {
      lines.push(`Redirected to: ${new URL(response.url).pathname}`);
    }

    showResult(lines.join('\n'), statusClass(response.status), body);
  } catch (error) {
    // Network failure (server stopped, connection refused) or an invalid body.
    showResult(
      `${method} ${path}\nRequest failed`,
      'error',
      `Could not complete the request: ${error.message}`,
    );
  }
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    await callRoute(button.dataset.method, button.dataset.path);
    button.disabled = false;
  });
}