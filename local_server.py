#!/usr/bin/env python3
"""
Basic HTTP server for serving Looker custom visualizations
Serves all sub-directories on localhost:89
"""

import os
import sys
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, unquote
import mimetypes

class CustomVisualizationHandler(SimpleHTTPRequestHandler):
    """
    Custom HTTP request handler that serves files from sub-directories
    and provides a directory listing for visualization discovery
    """
    
    def __init__(self, *args, **kwargs):
        # Set the server directory to the current working directory
        self.server_directory = os.getcwd()
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            # Parse the URL path
            parsed_path = urlparse(self.path)
            path = unquote(parsed_path.path)
            
            # Remove leading slash and resolve the full path
            if path.startswith('/'):
                path = path[1:]
            
            full_path = os.path.join(self.server_directory, path)
            
            # Security check: ensure the path is within the server directory
            if not full_path.startswith(self.server_directory):
                self.send_error(403, "Forbidden")
                return
            
            # If root path, show directory listing of sub-directories
            if path == '' or path == '/':
                self.serve_directory_listing()
                return
            
            # If path exists and is a file, serve it
            if os.path.isfile(full_path):
                self.serve_file(full_path)
                return
            
            # If path is a directory, serve its contents
            if os.path.isdir(full_path):
                # Look for index.html or index.js first
                for index_file in ['index.html', 'index.js']:
                    index_path = os.path.join(full_path, index_file)
                    if os.path.isfile(index_path):
                        self.serve_file(index_path)
                        return
                
                # If no index file, show directory contents
                self.serve_directory_contents(full_path, path)
                return
            
            # Path doesn't exist
            self.send_error(404, "File not found")
            
        except Exception as e:
            print(f"Error handling request: {e}")
            self.send_error(500, "Internal server error")
    
    def serve_file(self, file_path):
        """Serve a single file with appropriate MIME type"""
        try:
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                mime_type = 'application/octet-stream'
            
            # Read and serve the file
            with open(file_path, 'rb') as file:
                content = file.read()
                
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Access-Control-Allow-Origin', '*')  # Enable CORS
            self.end_headers()
            self.wfile.write(content)
            
        except Exception as e:
            print(f"Error serving file {file_path}: {e}")
            self.send_error(500, "Error reading file")
    
    def serve_directory_listing(self):
        """Serve the main directory listing showing available visualizations"""
        try:
            # Get all subdirectories
            subdirs = []
            for item in os.listdir(self.server_directory):
                item_path = os.path.join(self.server_directory, item)
                if os.path.isdir(item_path) and not item.startswith('.'):
                    subdirs.append(item)
            
            # Generate HTML response
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Looker Custom Visualizations</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; }}
                    h1 {{ color: #333; }}
                    .visualization {{ 
                        border: 1px solid #ddd; 
                        padding: 20px; 
                        margin: 10px 0; 
                        border-radius: 5px; 
                    }}
                    .visualization:hover {{ background-color: #f5f5f5; }}
                    a {{ text-decoration: none; color: #007cba; }}
                    a:hover {{ text-decoration: underline; }}
                    .info {{ color: #666; font-size: 0.9em; }}
                </style>
            </head>
            <body>
                <h1>Looker Custom Visualizations</h1>
                <h2>Available Visualizations:</h2>
            """
            
            if subdirs:
                for subdir in sorted(subdirs):
                    html_content += f"""
                    <div class="visualization">
                        <h3><a href="/{subdir}/">{subdir}</a></h3>
                        <p><a href="/{subdir}/">Browse files →</a></p>
                    </div>
                    """
            else:
                html_content += "<p>No visualization directories found.</p>"
            
            html_content += """
                </body>
            </html>
            """
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', str(len(html_content.encode())))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(html_content.encode())
            
        except Exception as e:
            print(f"Error serving directory listing: {e}")
            self.send_error(500, "Error generating directory listing")
    
    def serve_directory_contents(self, dir_path, url_path):
        """Serve directory contents as HTML listing"""
        try:
            items = []
            for item in os.listdir(dir_path):
                item_path = os.path.join(dir_path, item)
                is_dir = os.path.isdir(item_path)
                items.append((item, is_dir))
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Directory: /{url_path}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; }}
                    h1 {{ color: #333; }}
                    .file {{ padding: 5px 0; }}
                    .dir {{ font-weight: bold; }}
                    a {{ text-decoration: none; color: #007cba; }}
                    a:hover {{ text-decoration: underline; }}
                    .back {{ margin-bottom: 20px; }}
                </style>
            </head>
            <body>
                <div class="back"><a href="/">← Back to visualizations</a></div>
                <h1>Directory: /{url_path}</h1>
            """
            
            for item, is_dir in sorted(items):
                if is_dir:
                    html_content += f'<div class="file dir"><a href="/{url_path}/{item}/">{item}/</a></div>'
                else:
                    html_content += f'<div class="file"><a href="/{url_path}/{item}">{item}</a></div>'
            
            html_content += """
                </body>
            </html>
            """
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', str(len(html_content.encode())))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(html_content.encode())
            
        except Exception as e:
            print(f"Error serving directory contents: {e}")
            self.send_error(500, "Error reading directory")

def run_server(port=89):
    """Start the HTTP server"""
    try:
        server_address = ('localhost', port)
        httpd = HTTPServer(server_address, CustomVisualizationHandler)
        
        print(f"Starting server on http://localhost:{port}")
        print(f"Serving directory: {os.getcwd()}")
        print("Press Ctrl+C to stop the server")
        print()
        
        httpd.serve_forever()
        
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except PermissionError:
        print(f"Error: Permission denied to bind to port {port}")
        print("Try running with a different port or with sudo privileges")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Error: Port {port} is already in use")
            print("Please stop any other services using this port or choose a different port")
        else:
            print(f"Error starting server: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    # Check for port argument
    port = 80
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Error: Port must be a number")
            sys.exit(1)
    
    run_server(port)