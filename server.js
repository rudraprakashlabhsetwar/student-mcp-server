const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const axios = require('axios');

// Backend REST API URL (Render service: student-api)
const API_URL = (process.env.STUDENT_API_URL || 'https://student-api-xjlq.onrender.com/api').replace(/\/+$/, '');

const app = express();
app.use(express.json());

// Health check route: ALSO pings backend /health so waking MCP wakes the backend
app.get('/health', async (req, res) => {
  let backendHealthStatus = 'unknown';
  try {
    const backendBase = API_URL.replace(/\/api\/?$/, '');
    const resp = await axios.get(`${backendBase}/health`, { timeout: 15000 });
    backendHealthStatus = resp.data?.status === 'healthy' ? 'connected' : resp.data?.status || 'reachable';
  } catch (err) {
    backendHealthStatus = `unreachable: ${err.message}`;
  }

  res.json({
    status: 'healthy',
    service: 'student-mcp-server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    backendHealth: backendHealthStatus,
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'student-mcp-server',
    version: '1.0.0',
    description: 'Model Context Protocol Server for Student Management System',
    endpoints: {
      health: '/health',
      mcp: '/mcp',
    },
    tools: ['list_students', 'add_student', 'search_student'],
  });
});

// MCP Streamable HTTP Endpoint (Stateless: sessionIdGenerator is undefined)
app.post('/mcp', async (req, res) => {
  try {
    const server = new McpServer({
      name: 'student-mcp-server',
      version: '1.0.0',
    });

    // Tool 1: list_students
    server.registerTool(
      'list_students',
      { 
        description: 'Get all students from the Student Management System', 
        inputSchema: {} 
      },
      async () => {
        try {
          const { data } = await axios.get(`${API_URL}/students`);
          return {
            content: [{ 
              type: 'text', 
              text: `Total ${data.count} students:\n${JSON.stringify(data.data, null, 2)}` 
            }],
          };
        } catch (err) {
          const msg = err.response?.data?.message || err.message || 'Error fetching students';
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to list students: ${msg}` }],
          };
        }
      }
    );

    // Tool 2: add_student (contact is optional 10-digit string)
    server.registerTool(
      'add_student',
      {
        description: 'Add a new student to the system',
        inputSchema: {
          studentId: z.string().describe('Unique student ID like ST101 or A552'),
          name: z.string().describe('Full name of the student'),
          email: z.string().email().describe('Valid student email address'),
          department: z.string().describe('Department (Computer Science, Electrical, Civil, Mechanical)'),
          semester: z.number().min(1).max(8).describe('Semester number (1-8)'),
          contact: z.string().regex(/^\d{10}$/, 'Contact must be exactly 10 digits').optional().describe('Optional 10-digit phone number'),
        },
      },
      async (data) => {
        try {
          const { data: response } = await axios.post(`${API_URL}/students`, data);
          return { 
            content: [{ 
              type: 'text', 
              text: `✅ Added student: ${response.data.name} (${response.data.studentId}) with contact: ${response.data.contact || 'none'}` 
            }] 
          };
        } catch (err) {
          const msg = err.response?.data?.message || err.message || 'Error adding student';
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to add student: ${msg}` }],
          };
        }
      }
    );

    // Tool 3: search_student
    server.registerTool(
      'search_student',
      {
        description: 'Search student by name or student ID',
        inputSchema: { query: z.string().describe('Search keyword (name or student ID)') },
      },
      async ({ query }) => {
        try {
          const { data } = await axios.get(`${API_URL}/students`);
          const results = (data.data || []).filter(s => 
            (s.name && s.name.toLowerCase().includes(query.toLowerCase())) || 
            (s.studentId && s.studentId.toLowerCase().includes(query.toLowerCase()))
          );
          if (results.length === 0) {
            return { content: [{ type: 'text', text: `No student found matching: "${query}"` }] };
          }
          return { 
            content: [{ 
              type: 'text', 
              text: `Found ${results.length} student(s):\n${JSON.stringify(results, null, 2)}` 
            }] 
          };
        } catch (err) {
          const msg = err.response?.data?.message || err.message || 'Error searching student';
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to search students: ${msg}` }],
          };
        }
      }
    );

    // Stateless Streamable HTTP Transport
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MCP Server running on 0.0.0.0:${PORT}`);
});
