const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const axios = require('axios');

// Backend REST API URL
const API_URL = (process.env.STUDENT_API_URL || 'https://student-api-xjlq.onrender.com/api').replace(/\/+$/, '');

const app = express();
app.use(express.json());

// Health check route (Render & Monitoring)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'student-mcp-server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
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

// MCP Streamable HTTP Endpoint
app.post('/mcp', async (req, res) => {
  try {
    const server = new McpServer({
      name: 'student-mcp-server',
      version: '1.0.0',
    });

    // Tool 1: List all students
    server.registerTool(
      'list_students',
      { 
        description: 'Get all students from the Student Management System', 
        inputSchema: {} 
      },
      async () => {
        const { data } = await axios.get(`${API_URL}/students`);
        return {
          content: [{ 
            type: 'text', 
            text: `Total ${data.count} students:\n${JSON.stringify(data.data, null, 2)}` 
          }],
        };
      }
    );

    // Tool 2: Add new student with 10-digit contact validation
    server.registerTool(
      'add_student',
      {
        description: 'Add a new student to the system with validated 10-digit contact',
        inputSchema: {
          studentId: z.string().describe('Unique student ID like ST101 or A552'),
          name: z.string().describe('Full name of the student'),
          email: z.string().email().describe('Valid student email address'),
          department: z.string().describe('Department (Computer Science, Electrical, Civil, Mechanical)'),
          semester: z.number().min(1).max(8).describe('Semester number (1-8)'),
          contact: z.string().regex(/^\d{10}$/, 'Contact must be exactly 10 digits').describe('Exactly 10-digit phone number'),
        },
      },
      async (data) => {
        const { data: response } = await axios.post(`${API_URL}/students`, data);
        return { 
          content: [{ 
            type: 'text', 
            text: `✅ Added student: ${response.data.name} (${response.data.studentId}) with contact: ${response.data.contact}` 
          }] 
        };
      }
    );

    // Tool 3: Search student by name or ID
    server.registerTool(
      'search_student',
      {
        description: 'Search student by name or student ID',
        inputSchema: { query: z.string().describe('Search keyword (name or student ID)') },
      },
      async ({ query }) => {
        const { data } = await axios.get(`${API_URL}/students`);
        const results = (data.data || []).filter(s => 
          (s.name && s.name.toLowerCase().includes(query.toLowerCase())) || 
          (s.studentId && s.studentId.toLowerCase().includes(query.toLowerCase()))
        );
        if (results.length === 0) {
          return { content: [{ type: 'text', text: `No student found for: ${query}` }] };
        }
        return { 
          content: [{ 
            type: 'text', 
            text: `Found ${results.length} student(s):\n${JSON.stringify(results, null, 2)}` 
          }] 
        };
      }
    );

    // Transport setup
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
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
