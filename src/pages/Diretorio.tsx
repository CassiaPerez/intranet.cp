import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Phone, Mail, MapPin, Building } from 'lucide-react';

interface Employee {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  email: string;
  telefone: string;
  cidade: string;
  ramal?: string;
  foto?: string;
}

export const Diretorio: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // carrega UMA vez de public/dados/funcionarios.json
  useEffect(() => {
    const load = async () => {
      try {
        const url = `${import.meta.env.BASE_URL || '/'}dados/funcionarios.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Falha ao carregar funcionarios.json');
        const text = await res.text();
        const data = text ? JSON.parse(text) : [];
        setAllEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Erro ao carregar funcionários:', e);
        setAllEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // filtro local (sem nova chamada de rede)
  const employees = useMemo(() => {
    if (!searchTerm) return allEmployees;
    const q = searchTerm.toLowerCase();
    const safe = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : '');
    return allEmployees.filter((c) =>
      safe(c.nome).includes(q) ||
      safe(c.email).includes(q) ||
      safe(c.ramal).includes(q) ||
      safe(c.setor).includes(q) ||
      safe(c.cargo).includes(q) ||
      safe(c.cidade).includes(q) ||
      safe(c.telefone).includes(q)
    );
  }, [allEmployees, searchTerm]);

  const groupedEmployees = useMemo(() => {
    return employees.reduce((groups, employee) => {
      const dept = employee.setor || 'Sem setor';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(employee);
      return groups;
    }, {} as Record<string, Employee[]>);
  }, [employees]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Diretório Corporativo</h1>
          <div className="text-sm text-gray-600">
            {employees.length} colaboradores encontrados
          </div>
        </div>

        {/* Filtro */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pesquisar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, cargo, email, setor, cidade..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">
            {Object.entries(groupedEmployees).map(([department, departmentEmployees]) => (
              <div key={department} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-6">
                  <Building className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900">{department}</h2>
                  <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    {departmentEmployees.length} pessoas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departmentEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start space-x-4">
                        <img
                          src={
                            employee.foto ||
                            'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150'
                          }
                          alt={employee.nome}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{employee.nome}</h3>
                          <p className="text-sm text-gray-600 truncate">{employee.cargo}</p>

                          <div className="mt-3 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <a
                                href={`mailto:${employee.email}`}
                                className="text-sm text-blue-600 hover:underline truncate"
                              >
                                {employee.email}
                              </a>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{employee.telefone}</span>
                              {employee.ramal && (
                                <span className="text-xs text-gray-500">({employee.ramal})</span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">{employee.cidade}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum colaborador encontrado</h3>
            <p className="text-gray-600">Tente ajustar os filtros de pesquisa</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
