import { PortableText } from '@portabletext/react';
import refractorPkg from 'refractor';
import GithubSlugger from 'github-slugger';

const refractor: any = (refractorPkg as any).default || refractorPkg;

const portableTextComponents: any = {
  types: {
    math: ({ value }: any) => (
      <pre className="math overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100">
        {value.code || value.text || JSON.stringify(value)}
      </pre>
    ),
    image: ({ value }: any) => (
      <img
        alt={value.alt || ''}
        src={value.src}
        width={value.width || 800}
        height={value.height || 600}
        className="rounded-xl mx-auto my-6"
        loading="lazy"
      />
    ),
    code: ({ value }: any) => {
      let highlightedElements: any = null;
      try {
        const lang = value.language || 'text';
        if (refractor.registered(lang)) {
          const ast = refractor.highlight(value.code, lang);

          const hastToReact = (node: any, index: number = 0): any => {
            if (node.type === 'text') return node.value;
            if (node.type === 'element') {
              const props: any = { key: index };
              if (node.properties?.className) {
                props.className = Array.isArray(node.properties.className)
                  ? node.properties.className.join(' ')
                  : node.properties.className;
              }
              const TagName = node.tagName;
              return (
                <TagName {...props}>
                  {(node.children || []).map((child: any, i: number) => hastToReact(child, i))}
                </TagName>
              );
            }
            return null;
          };

          highlightedElements = ast.children.map((node: any, i: number) => hastToReact(node, i));
        }
      } catch (e) {
        // Fallback to plain text on error
      }

      return (
        <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100 my-4">
          <code className={`language-${value.language || 'text'}`}>
            {highlightedElements ? highlightedElements : value.code}
          </code>
        </pre>
      );
    },
    'code-block': ({ value }: any) => {
      let highlightedElements: any = null;
      const rawCode = (value.lines || [])
        .map((line: any) => (line.children || []).map((child: any) => child.text || '').join(''))
        .join('\n');

      try {
        const lang = value.language || 'text';
        if (refractor.registered(lang)) {
          const ast = refractor.highlight(rawCode, lang);

          const hastToReact = (node: any, index: number = 0): any => {
            if (node.type === 'text') return node.value;
            if (node.type === 'element') {
              const props: any = { key: index };
              if (node.properties?.className) {
                props.className = Array.isArray(node.properties.className)
                  ? node.properties.className.join(' ')
                  : node.properties.className;
              }
              const TagName = node.tagName;
              return (
                <TagName {...props}>
                  {(node.children || []).map((child: any, i: number) => hastToReact(child, i))}
                </TagName>
              );
            }
            return null;
          };

          highlightedElements = ast.children.map((node: any, i: number) => hastToReact(node, i));
        }
      } catch (e) {
        // Fallback
      }

      return (
        <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100 my-4">
          <code className={`language-${value.language || 'text'}`}>
            {highlightedElements ? highlightedElements : rawCode}
          </code>
        </pre>
      );
    },
    video: ({ value }: any) => (
      <video {...value.attributes} className="rounded-xl mx-auto my-6">
        {value.children}
      </video>
    ),
  },
  marks: {
    link: ({ children, value }: any) => {
      const href = value.href || '';
      return (
        <a
          href={href}
          className="text-primary-500 hover:text-primary-600 underline font-medium"
        >
          {children}
        </a>
      );
    },
  },
  block: {
    normal: ({ children }: any) => <p className="mb-4 leading-relaxed">{children}</p>,
    h1: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || '';
      const id = new GithubSlugger().slug(text);
      return (
        <h1 id={id} className="text-3xl font-extrabold mt-8 mb-4 tracking-tight">
          {children}
        </h1>
      );
    },
    h2: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || '';
      const id = new GithubSlugger().slug(text);
      return (
        <h2 id={id} className="text-2xl font-bold mt-6 mb-3 tracking-tight">
          {children}
        </h2>
      );
    },
    h3: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || '';
      const id = new GithubSlugger().slug(text);
      return (
        <h3 id={id} className="text-xl font-bold mt-5 mb-2 tracking-tight">
          {children}
        </h3>
      );
    },
    h4: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || '';
      const id = new GithubSlugger().slug(text);
      return (
        <h4 id={id} className="text-lg font-semibold mt-4 mb-2">
          {children}
        </h4>
      );
    },
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary-500 pl-4 py-1 italic my-4 text-gray-600 dark:text-gray-300">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: any) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
    number: ({ children }: any) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }: any) => <li>{children}</li>,
    number: ({ children }: any) => <li>{children}</li>,
  },
};

export default function PortableTextRenderer({ value }: { value: any }) {
  if (!value) return null;
  return (
    <div className="prose dark:prose-invert max-w-none">
      <PortableText value={value} components={portableTextComponents} />
    </div>
  );
}

