import { toHTML, escapeHTML } from '@portabletext/to-html';
import refractorPkg from 'refractor';
import GithubSlugger from 'github-slugger';

const refractor: any = (refractorPkg as any).default || refractorPkg;

function hastToHtml(node: any): string {
  if (!node) return '';
  if (Array.isArray(node)) {
    return node.map(hastToHtml).join('');
  }
  if (node.type === 'text') {
    return escapeHTML(node.value || '');
  }
  if (node.type === 'element') {
    const tagName = node.tagName || 'span';
    const classes = Array.isArray(node.properties?.className)
      ? node.properties.className.join(' ')
      : node.properties?.className || '';
    const classAttr = classes ? ` class="${escapeHTML(classes)}"` : '';
    const childrenHtml = (node.children || []).map(hastToHtml).join('');
    return `<${tagName}${classAttr}>${childrenHtml}</${tagName}>`;
  }
  if (node.type === 'root') {
    return (node.children || []).map(hastToHtml).join('');
  }
  return '';
}

function renderCode(code: string, language?: string): string {
  const lang = language || 'text';
  let highlighted = escapeHTML(code);
  try {
    if (refractor.registered(lang)) {
      const ast = refractor.highlight(code, lang);
      highlighted = hastToHtml(ast);
    }
  } catch {
    // fallback to escaped plain text on highlighting error
  }
  return `<pre class="overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100 my-4"><code class="language-${escapeHTML(lang)}">${highlighted}</code></pre>`;
}

export function renderPortableTextToHtml(value: any): string {
  if (!value) return '';
  const blocks = Array.isArray(value) ? value : [value];
  const slugger = new GithubSlugger();

  return toHTML(blocks, {
    components: {
      types: {
        math: ({ value }: any) => {
          const content = value.code || value.text || JSON.stringify(value);
          return `<pre class="math overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100">${escapeHTML(content)}</pre>`;
        },
        image: ({ value }: any) => {
          const src = escapeHTML(value.src || '');
          const alt = escapeHTML(value.alt || '');
          const width = value.width || 800;
          const height = value.height || 600;
          return `<img src="${src}" alt="${alt}" width="${width}" height="${height}" class="rounded-xl mx-auto my-6" loading="lazy" />`;
        },
        code: ({ value }: any) => {
          return renderCode(value.code || '', value.language);
        },
        'code-block': ({ value }: any) => {
          const rawCode = (value.lines || [])
            .map((line: any) => (line.children || []).map((child: any) => child.text || '').join(''))
            .join('\n');
          return renderCode(rawCode, value.language);
        },
        video: ({ value }: any) => {
          const attrs = value.attributes || {};
          const attrStr = Object.entries(attrs)
            .map(([k, v]) => `${escapeHTML(k)}="${escapeHTML(String(v))}"`)
            .join(' ');
          return `<video ${attrStr} class="rounded-xl mx-auto my-6"></video>`;
        },
      },
      marks: {
        link: ({ children, value }: any) => {
          const href = escapeHTML(value?.href || '');
          return `<a href="${href}" class="text-primary-500 hover:text-primary-600 underline font-medium">${children}</a>`;
        },
      },
      block: {
        normal: ({ children }: any) => `<p class="mb-4 leading-relaxed">${children}</p>`,
        h1: ({ children, value }: any) => {
          const text = value?.children?.map((c: any) => c.text).join('') || '';
          const id = slugger.slug(text);
          return `<h1 id="${id}" class="text-3xl font-extrabold mt-8 mb-4 tracking-tight">${children}</h1>`;
        },
        h2: ({ children, value }: any) => {
          const text = value?.children?.map((c: any) => c.text).join('') || '';
          const id = slugger.slug(text);
          return `<h2 id="${id}" class="text-2xl font-bold mt-6 mb-3 tracking-tight">${children}</h2>`;
        },
        h3: ({ children, value }: any) => {
          const text = value?.children?.map((c: any) => c.text).join('') || '';
          const id = slugger.slug(text);
          return `<h3 id="${id}" class="text-xl font-bold mt-5 mb-2 tracking-tight">${children}</h3>`;
        },
        h4: ({ children, value }: any) => {
          const text = value?.children?.map((c: any) => c.text).join('') || '';
          const id = slugger.slug(text);
          return `<h4 id="${id}" class="text-lg font-semibold mt-4 mb-2">${children}</h4>`;
        },
        blockquote: ({ children }: any) => {
          return `<blockquote class="border-l-4 border-primary-500 pl-4 py-1 italic my-4 text-gray-600 dark:text-gray-300">${children}</blockquote>`;
        },
      },
      list: {
        bullet: ({ children }: any) => `<ul class="list-disc pl-6 mb-4 space-y-1">${children}</ul>`,
        number: ({ children }: any) => `<ol class="list-decimal pl-6 mb-4 space-y-1">${children}</ol>`,
      },
      listItem: {
        bullet: ({ children }: any) => `<li>${children}</li>`,
        number: ({ children }: any) => `<li>${children}</li>`,
      },
    },
  });
}
