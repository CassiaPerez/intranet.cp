import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'Olá! Sou o assistente virtual da Cropfield. Como posso ajudar você hoje?',
      isBot: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: inputValue,
      isBot: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: getBotResponse(inputValue),
        isBot: true,
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('sala') || message.includes('reserva')) {
      return 'Para reservar uma sala, acesse o menu "Reservas" e clique na data/hora desejada. Temos 4 salas disponíveis: Aquário, Grande, Pequena e Recepção.';
    }
    
    if (message.includes('cardápio') || message.includes('almoço')) {
      return 'O cardápio está disponível no menu "Cardápio". Você pode ver o menu padrão e light, além de solicitar troca de proteínas.';
    }
    
    if (message.includes('equipamento') || message.includes('ti')) {
      return 'Para solicitar equipamentos de TI, acesse o menu "Equipamentos" e preencha o formulário. A equipe de TI será notificada automaticamente.';
    }
    
    if (message.includes('contato') || message.includes('telefone')) {
      return 'Você pode encontrar todos os contatos dos colaboradores no "Diretório Corporativo" com filtros por setor e cidade.';
    }
    
    return 'Posso ajudar com informações sobre reservas de salas, cardápio, equipamentos de TI, diretório de contatos e muito mais! O que você gostaria de saber?';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
        title="Assistente Virtual"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Assistente Virtual</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      message.isBot
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};