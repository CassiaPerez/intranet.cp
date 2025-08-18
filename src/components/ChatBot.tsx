import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  pergunta: string;
  palavras_chave: string[];
  resposta: string;
  categoria: string;
}

interface Contact {
  nome: string;
  cargo?: string;
  setor?: string;
  email?: string;
  telefone?: string;
  ramal?: string | number;
}

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'Olá! Sou o assistente virtual da Cropfield. Posso ajudar com informações sobre a intranet, contatos, cardápio, reservas e muito mais. Como posso ajudar você hoje?',
      isBot: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar base de conhecimento e dados da empresa
  useEffect(() => {
    const loadData = async () => {
      try {
        // Carregar base de conhecimento
        const knowledgeResponse = await fetch('/dados/chatbot_knowledge.json');
        if (knowledgeResponse.ok) {
          const knowledgeData = await knowledgeResponse.json();
          setKnowledgeBase(Array.isArray(knowledgeData) ? knowledgeData : []);
        }

        // Carregar contatos para consultas dinâmicas
        const contactsResponse = await fetch('/dados/contatos.json');
        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          
          // Normalizar dados de contatos
          const allContacts: Contact[] = [];
          
          // Adicionar representantes
          if (Array.isArray(contactsData.representantes)) {
            allContacts.push(...contactsData.representantes.map((rep: any) => ({
              nome: rep.nome,
              cargo: rep.cargo || 'Representante',
              setor: rep.setor || rep.localizacao,
              email: rep.email,
              telefone: rep.telefone,
              ramal: null
            })));
          }
          
          // Adicionar equipe de Apucarana
          if (Array.isArray(contactsData.equipe_apucarana_pr)) {
            allContacts.push(...contactsData.equipe_apucarana_pr.map((emp: any) => ({
              nome: emp.nome,
              cargo: emp.cargo,
              setor: emp.setor,
              email: emp.email,
              telefone: emp.telefone,
              ramal: emp.ramal
            })));
          }
          
          setContacts(allContacts);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do chatbot:', error);
      }
    };

    loadData();
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: inputValue,
      isBot: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
    setLoading(true);

    // Simular delay de processamento
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: getBotResponse(inputValue),
        isBot: true,
      };
      setMessages((prev) => [...prev, botResponse]);
      setLoading(false);
    }, 1000);
  };

  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase().trim();
    
    // Respostas específicas existentes (mantidas para compatibilidade)
    if (message.includes('sala') && message.includes('reserva')) {
      return 'Para reservar uma sala, acesse o menu "Reservas" e clique na data/hora desejada. Temos 4 salas disponíveis: Aquário (8 pessoas), Grande (20 pessoas), Pequena (6 pessoas) e Recepção (4 pessoas).';
    }
    
    if (message.includes('cardápio') || message.includes('almoço')) {
      return 'O cardápio está disponível no menu "Cardápio". Você pode ver o menu do mês e acessar "Troca de Proteínas" para solicitar alterações. Lembre-se: trocas devem ser feitas até 16h do dia anterior!';
    }
    
    if (message.includes('equipamento') && message.includes('ti')) {
      return 'Para solicitar equipamentos de TI, acesse o menu "Equipamentos" e preencha o formulário. Selecione o tipo (notebook, desktop, smartphone, etc.), defina a prioridade e justifique a necessidade. A equipe de TI será notificada automaticamente.';
    }

    // Busca inteligente na base de conhecimento
    const bestMatch = findBestMatch(message, knowledgeBase);
    if (bestMatch && bestMatch.score > 0) {
      return bestMatch.item.resposta;
    }

    // Consultas dinâmicas sobre contatos
    if (message.includes('contato') || message.includes('telefone') || message.includes('ramal')) {
      // Buscar por setor específico
      const setores = ['rh', 'ti', 'comercial', 'financeiro', 'comex', 'contabilidade', 'crédito', 'faturamento'];
      const setorMencionado = setores.find(setor => message.includes(setor));
      
      if (setorMencionado) {
        const contactsFromSetor = contacts.filter(c => 
          c.setor?.toLowerCase().includes(setorMencionado) ||
          c.cargo?.toLowerCase().includes(setorMencionado)
        );
        
        if (contactsFromSetor.length > 0) {
          const examples = contactsFromSetor.slice(0, 3).map(c => 
            `${c.nome} - ${c.cargo}${c.ramal ? ` (Ramal: ${c.ramal})` : ''}${c.telefone ? ` (Tel: ${c.telefone})` : ''}`
          ).join('\n');
          
          return `Encontrei ${contactsFromSetor.length} contato(s) do setor ${setorMencionado.toUpperCase()}:\n\n${examples}${contactsFromSetor.length > 3 ? '\n\nConsulte o Diretório para ver todos os contatos.' : ''}`;
        }
      }
      
      return 'Você pode encontrar todos os contatos dos colaboradores no "Diretório Corporativo" com filtros por setor e cidade. Há mais de 150 contatos organizados por localização e departamento.';
    }

    // Consultas sobre pessoas específicas
    if (message.includes('quem é') || message.includes('quem trabalha')) {
      const nomesBuscados = extractNames(message);
      if (nomesBuscados.length > 0) {
        const contactsFound = contacts.filter(c => 
          nomesBuscados.some(nome => c.nome.toLowerCase().includes(nome))
        );
        
        if (contactsFound.length > 0) {
          const info = contactsFound[0];
          return `${info.nome} trabalha como ${info.cargo} no setor ${info.setor}. ${info.email ? `Email: ${info.email}` : ''}${info.ramal ? ` | Ramal: ${info.ramal}` : ''}${info.telefone ? ` | Tel: ${info.telefone}` : ''}`;
        }
      }
    }

    // Consultas sobre datas e agenda
    if (message.includes('hoje') || message.includes('amanhã') || message.includes('data')) {
      const hoje = new Date();
      const amanha = new Date(hoje);
      amanha.setDate(hoje.getDate() + 1);
      
      return `Hoje é ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}. Para consultar o cardápio de hoje ou amanhã, acesse o menu "Cardápio". Para ver a agenda de reuniões, consulte "Reservas".`;
    }

    // Respostas padrão para categorias gerais
    if (message.includes('ajuda') || message.includes('help')) {
      return 'Posso ajudar com:\n\n🏢 Informações da empresa e setores\n📞 Contatos e ramais\n🍽️ Cardápio e trocas de proteína\n📅 Reservas de salas\n🎂 Aniversariantes\n💻 Solicitações de equipamentos\n📱 Como usar a intranet\n🎯 Sistema de pontuação\n\nFaça sua pergunta!';
    }

    // Resposta padrão melhorada
    return 'Desculpe, não encontrei uma resposta específica para sua pergunta. Posso ajudar com informações sobre:\n\n• Reservas de salas e agendamentos\n• Cardápio e trocas de proteínas\n• Contatos e diretório corporativo\n• Equipamentos de TI\n• Aniversariantes e eventos\n• Como usar os recursos da intranet\n\nTente reformular sua pergunta ou seja mais específico!';
  };

  // Função para encontrar a melhor correspondência na base de conhecimento
  const findBestMatch = (userMessage: string, knowledge: KnowledgeItem[]) => {
    let bestMatch = { item: null as KnowledgeItem | null, score: 0 };
    
    for (const item of knowledge) {
      let score = 0;
      
      // Verificar correspondências nas palavras-chave
      for (const keyword of item.palavras_chave) {
        if (userMessage.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      
      // Bonus para correspondências exatas ou múltiplas
      const keywordsFound = item.palavras_chave.filter(keyword => 
        userMessage.includes(keyword.toLowerCase())
      );
      
      if (keywordsFound.length > 1) {
        score += keywordsFound.length * 0.5; // Bonus para múltiplas palavras-chave
      }
      
      if (score > bestMatch.score) {
        bestMatch = { item, score };
      }
    }
    
    return bestMatch;
  };

  // Função para extrair nomes da mensagem
  const extractNames = (message: string): string[] => {
    const words = message.toLowerCase().split(' ');
    const names: string[] = [];
    
    // Buscar nomes após "quem é" ou "quem trabalha"
    const whoIndex = words.findIndex(word => word === 'é' || word === 'trabalha');
    if (whoIndex !== -1 && whoIndex < words.length - 1) {
      // Pegar as próximas palavras como possível nome
      const possibleName = words.slice(whoIndex + 1).join(' ');
      if (possibleName.length > 2) {
        names.push(possibleName);
      }
    }
    
    return names;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-gray-400 hover:text-blue-600 transition-colors"
        title="Assistente Virtual"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[500px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Assistente Cropfield</h3>
                  <p className="text-xs opacity-90">Online agora</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[85%] ${message.isBot ? '' : 'flex-row-reverse space-x-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.isBot ? 'bg-blue-600' : 'bg-gray-600'
                    }`}>
                      {message.isBot ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        message.isBot
                          ? 'bg-white text-gray-900 shadow-sm border'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-white rounded-b-lg">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                  placeholder="Digite sua pergunta..."
                  disabled={loading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loading || !inputValue.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              {/* Quick suggestions */}
              <div className="mt-2 flex flex-wrap gap-1">
                {['Contatos RH', 'Reservar sala', 'Cardápio hoje', 'Horário empresa'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};