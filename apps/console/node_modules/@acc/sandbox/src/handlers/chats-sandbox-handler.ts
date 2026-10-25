import type { SandboxRouteHandler, SandboxRequest } from '../types';
import convoData from './data/convo.json';
import { sandboxResetRegistry } from '../reset-registry';

export type ChatUser = (typeof convoData.conversations)[number];
export type Convo = ChatUser['messages'][number];

export class ChatsSandboxRepository {
  private conversations: ChatUser[] = [];

  constructor() {
    this.reset();
    sandboxResetRegistry.register(() => this.reset());
  }

  public reset(): void {
    this.conversations = JSON.parse(JSON.stringify(convoData.conversations));
  }

  public getAll(): ChatUser[] {
    return [...this.conversations];
  }

  public getById(id: string): ChatUser | undefined {
    return this.conversations.find((c) => c.id === id);
  }

  public addMessage(convoId: string, message: { sender: string; message: string; timestamp?: string }): ChatUser | null {
    const convo = this.getById(convoId);
    if (!convo) return null;

    convo.messages.push({
      sender: message.sender,
      message: message.message,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    return convo;
  }

  public createConversation(newConvo: Partial<ChatUser>): ChatUser {
    const convo: ChatUser = {
      id: newConvo.id || `conv-${Date.now()}`,
      profile: newConvo.profile || 'https://randomuser.me/api/portraits/men/1.jpg',
      username: newConvo.username || 'new_user',
      fullName: newConvo.fullName || 'New Contact',
      title: newConvo.title || 'Member',
      messages: newConvo.messages || [],
    };
    this.conversations.unshift(convo);
    return convo;
  }
}

export const chatsSandboxRepo = new ChatsSandboxRepository();

export const chatsSandboxHandler: SandboxRouteHandler = {
  id: 'chats-sandbox-handler',
  name: 'Chats Sandbox Repository',
  description: 'In-memory stateful conversation repository for Chats feature',
  priority: 80,
  matcher: (ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    return cleanPath.startsWith('/chats');
  },
  handler: async (req: SandboxRequest, ctx) => {
    const cleanPath = ctx.pathname.replace(/^\/(api\/v1|api\/api|api|v1)/, '');
    const subPath = cleanPath.replace(/^\/chats/, '');

    if (subPath === '' || subPath === '/') {
      if (req.method === 'GET') {
        return { status: 200, data: chatsSandboxRepo.getAll() };
      }
      if (req.method === 'POST') {
        const created = chatsSandboxRepo.createConversation(req.data || {});
        return { status: 201, data: created };
      }
    }

    const msgMatch = subPath.match(/^\/([^/]+)\/messages$/);
    if (msgMatch && req.method === 'POST') {
      const convoId = msgMatch[1];
      const updated = chatsSandboxRepo.addMessage(convoId, req.data || {});
      if (!updated) return { status: 404, data: { message: 'Conversation not found' } };
      return { status: 200, data: updated };
    }

    const idMatch = subPath.match(/^\/([^/]+)$/);
    if (idMatch) {
      const id = idMatch[1];
      if (req.method === 'GET') {
        const convo = chatsSandboxRepo.getById(id);
        if (!convo) return { status: 404, data: { message: 'Conversation not found' } };
        return { status: 200, data: convo };
      }
      if (req.method === 'POST') {
        const updated = chatsSandboxRepo.addMessage(id, req.data || {});
        if (!updated) return { status: 404, data: { message: 'Conversation not found' } };
        return { status: 200, data: updated };
      }
    }

    return { status: 404, data: { message: 'Not found' } };
  },
};
