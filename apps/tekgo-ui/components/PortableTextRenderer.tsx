/* eslint-disable prettier/prettier */
 
import React from 'react'
import { PortableText } from '@portabletext/react'
import Image from './Image'
import CustomLink from './Link'
import TableWrapper from './TableWrapper'
import TOCInline from 'pliny/ui/TOCInline'
import Pre from 'pliny/ui/Pre'
import BlogNewsletterForm from 'pliny/ui/BlogNewsletterForm'

import { refractor } from 'refractor'

const portableTextComponents: any = {
  types: {
    math: ({ value }) => <pre className="math">{value.code || value.text || JSON.stringify(value)}</pre>,
    image: ({ value }) => (
      <Image alt={value.alt || ''} src={value.src} width={value.width || 800} height={value.height || 600} />
    ),
    code: ({ value }) => {
      let highlightedElements: React.ReactNode = null
      try {
        const lang = value.language || 'text'
        if (refractor.registered(lang)) {
          const ast = refractor.highlight(value.code, lang)
          
          const hastToReact = (node: any, index: number = 0): React.ReactNode => {
            if (node.type === 'text') return node.value
            if (node.type === 'element') {
              const props: any = { key: index }
              if (node.properties) {
                if (node.properties.className) {
                  props.className = Array.isArray(node.properties.className) 
                    ? node.properties.className.join(' ') 
                    : node.properties.className
                }
              }
              return React.createElement(
                node.tagName, 
                props, 
                (node.children || []).map((child: any, i: number) => hastToReact(child, i))
              )
            }
            return null
          }
          
          highlightedElements = ast.children.map((node: any, i: number) => hastToReact(node, i))
        }
      } catch (e) {
        // Fallback to plain text on error
      }
      
      return (
        <Pre>
          <code className={`language-${value.language || 'text'}`}>
            {highlightedElements ? highlightedElements : value.code}
          </code>
        </Pre>
      )
    },
    'code-block': ({ value }) => {
      let highlightedElements: React.ReactNode = null
      const rawCode = (value.lines || [])
        .map((line: any) => (line.children || []).map((child: any) => child.text || '').join(''))
        .join('\n')
        
      try {
        const lang = value.language || 'text'
        if (refractor.registered(lang)) {
          const ast = refractor.highlight(rawCode, lang)
          
          const hastToReact = (node: any, index: number = 0): React.ReactNode => {
            if (node.type === 'text') return node.value
            if (node.type === 'element') {
              const props: any = { key: index }
              if (node.properties && node.properties.className) {
                props.className = Array.isArray(node.properties.className) 
                  ? node.properties.className.join(' ') 
                  : node.properties.className
              }
              return React.createElement(
                node.tagName, 
                props, 
                (node.children || []).map((child: any, i: number) => hastToReact(child, i))
              )
            }
            return null
          }
          highlightedElements = ast.children.map((node: any, i: number) => hastToReact(node, i))
        }
      } catch (e) {
        // Fallback to plain text on error
      }
      
      return (
        <Pre>
          <code className={`language-${value.language || 'text'}`}>
            {highlightedElements ? highlightedElements : rawCode}
          </code>
        </Pre>
      )
    },
    video: ({ value }) => <video {...value.attributes}>{value.children}</video>
  },
  marks: {
    link: ({ children, value }) => {
      const href = value.href || ''
      if (href.startsWith('#fn-')) {
        const id = href.replace('#fn-', 'fnref-')
        return (
          <a href={href} id={id} className="text-primary-500 hover:text-primary-600 text-xs align-super ml-0.5">
            {children}
          </a>
        )
      }
      return <CustomLink href={href}>{children}</CustomLink>
    },
  },
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h1: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h1 id={slug}>{children}</h1>
    },
    h2: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h2 id={slug}>{children}</h2>
    },
    h3: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h3 id={slug}>{children}</h3>
    },
    h4: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h4 id={slug}>{children}</h4>
    },
    h5: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h5 id={slug}>{children}</h5>
    },
    h6: ({ children, value }: any) => {
      const text = value?.children?.map((c: any) => c.text).join('') || ''
      const slug = require('github-slugger').slug(text)
      return <h6 id={slug}>{children}</h6>
    },
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
}

export function PortableTextRenderer({ content, toc }: { content: any; toc?: any }) {
  const components = {
    ...portableTextComponents,
    types: {
      ...portableTextComponents.types,
      mdxComponent: ({ value }: any) => {
        const sanitizeAttribute = (val: any) => {
          if (val === null) return true
          if (val && val.type === 'mdxJsxAttributeValueExpression') {
            try {
              return JSON.parse(val.value)
            } catch {
              return val.value
            }
          }
          return val
        }
        
        if (value.name === 'TOCInline') {
          const { toc: _ignore, ...rawRest } = value.attributes || {}
          const rest = Object.fromEntries(
            Object.entries(rawRest).map(([k, v]) => [k, sanitizeAttribute(v)])
          )
          return <TOCInline {...rest} toc={toc || []} />
        }
        if (value.name === 'BlogNewsletterForm') {
          const rest = Object.fromEntries(
            Object.entries(value.attributes || {}).map(([k, v]) => [k, sanitizeAttribute(v)])
          )
          return <BlogNewsletterForm {...rest} />
        }
        return null
      },
    },
  }

  const contentArray = Array.isArray(content) ? content : []
  const mainContent = contentArray.filter((block: any) => block._type !== 'footnoteDefinition')
  const footnotes = contentArray.filter((block: any) => block._type === 'footnoteDefinition')

  return (
    <>
      <PortableText value={mainContent} components={components as any} />
      {footnotes.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Footnotes</h2>
          <ol className="list-decimal pl-6 space-y-4 text-sm text-gray-600 dark:text-gray-400">
            {footnotes.map((fn: any) => (
              <li key={fn.identifier} id={`fn-${fn.identifier}`} className="target:bg-gray-100 dark:target:bg-gray-800 rounded p-1">
                <div className="inline-block w-full prose-p:inline prose-p:m-0">
                  <PortableText value={fn.children} components={components as any} />
                  <a href={`#fnref-${fn.identifier}`} className="ml-2 text-primary-500 hover:text-primary-600 no-underline" data-footnote-backref>
                    &#8617;
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
