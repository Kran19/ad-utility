import React from 'react';

interface JsonLdProps {
  data: Record<string, any> | Array<Record<string, any>>;
}

/**
 * XSS-safe JSON-LD Script Component
 * Escapes characters to prevent script injection in structured data payloads.
 */
export const JsonLd: React.FC<JsonLdProps> = ({ data }) => {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // Prevent script tag injection by escaping '<' as '\u003c'
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
};
