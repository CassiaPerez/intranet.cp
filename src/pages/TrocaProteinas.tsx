import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Calendar, Clock, Utensils, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TrocaProteina {
  id: number;
  data: string;
  dia: string;
  proteina_original: string;
  proteina_nova: string;
  email: string;
  nome: string;
  created_at: string;
}

const proteinasDisponiveis = [
  'Frango',
  'Carne Bovina',
  'Peixe',
  'Porco',
  'Ovo',
  'Vegetariana',
  'Vegana'
];

export function TrocaProteinas() {
  const [trocas, setTrocas] = useState<TrocaProteina[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    data: '',
    proteina_original: '',
    proteina_nova: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    carregarTrocas();
  }, []);

  const carregarTrocas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/trocas-proteina', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrocas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar trocas:', error);
      toast.error('Erro ao carregar histórico de trocas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.data || !formData.proteina_original || !formData.proteina_nova) {
      toast.error('Todos os campos são obrigatórios');
      return;
    }

    if (formData.proteina_original === formData.proteina_nova) {
      toast.error('A proteína original deve ser diferente da nova proteína');
      return;
    }

    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/trocas-proteina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success('Troca de proteína registrada com sucesso! (+5 pontos)');
        setFormData({
          data: '',
          proteina_original: '',
          proteina_nova: ''
        });
        carregarTrocas();
      } else {
        toast.error(result.error || 'Erro ao registrar troca');
      }
    } catch (error) {
      console.error('Erro ao registrar troca:', error);
      toast.error('Erro ao registrar troca de proteína');
    } finally {
      setSubmitting(false);
    }
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Troca de Proteínas</h1>
          <p className="text-gray-600">
            Registre suas trocas de proteína do cardápio e ganhe pontos!
          </p>
        </div>

        {/* Formulário de Nova Troca */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Utensils className="w-5 h-5 mr-2 text-blue-600" />
            Nova Troca de Proteína
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da Refeição
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    min={getMinDate()}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proteína Original
                </label>
                <select
                  value={formData.proteina_original}
                  onChange={(e) => setFormData({ ...formData, proteina_original: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {proteinasDisponiveis.map((proteina) => (
                    <option key={proteina} value={proteina}>
                      {proteina}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Proteína
                </label>
                <select
                  value={formData.proteina_nova}
                  onChange={(e) => setFormData({ ...formData, proteina_nova: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {proteinasDisponiveis
                    .filter(proteina => proteina !== formData.proteina_original)
                    .map((proteina) => (
                      <option key={proteina} value={proteina}>
                        {proteina}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Importante:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Você pode registrar apenas uma troca por dia</li>
                    <li>A troca deve ser registrada no mesmo dia ou com antecedência</li>
                    <li>Cada troca registrada vale +5 pontos</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Registrar Troca
                </>
              )}
            </button>
          </form>
        </div>

        {/* Histórico de Trocas */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-green-600" />
            Histórico de Trocas
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : trocas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Utensils className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma troca registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trocas.map((troca) => (
                <div
                  key={troca.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <span className="font-medium text-gray-900">
                          {formatarData(troca.data)}
                        </span>
                        <span className="text-sm text-gray-500 capitalize">
                          {troca.dia}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                          {troca.proteina_original}
                        </span>
                        <span>→</span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                          {troca.proteina_nova}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-600 font-medium">
                        +5 pontos
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(troca.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}