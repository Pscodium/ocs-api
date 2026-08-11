/** 404 page served when a short code has no matching URL. Preserved verbatim
 *  from the legacy controller to keep behavior identical. */
export const notFoundPage = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>URL Não Encontrada</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; margin: 0 0 10px 0; }
                        p { color: #666; margin: 10px 0; }
                        a { color: #007bff; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>404 - URL Não Encontrada</h1>
                        <p>O link que você está tentando acessar não existe ou expirou.</p>
                        <a href="/">Voltar à página inicial</a>
                    </div>
                </body>
                </html>
            `;
