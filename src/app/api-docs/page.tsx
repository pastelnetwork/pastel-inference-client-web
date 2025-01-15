// src/app/api-docs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

function ApiDoc() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    fetch('/api/docs')
      .then(response => response.json())
      .then(data => setSpec(data));
  }, []);

  if (!spec) {
    return <div>Loading API documentation...</div>;
  }

  return (
    <div className="swagger-container">
      <SwaggerUI spec={spec} />
      <style jsx global>{`
        .swagger-container .swagger-ui {
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .swagger-container .scheme-container {
          background: none;
          box-shadow: none;
          padding: 0;
        }
      `}</style>
    </div>
  );
}

export default ApiDoc;