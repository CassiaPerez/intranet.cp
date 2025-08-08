import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Search, Phone, Mail, MapPin, Building } from 'lucide-react';
import { useGamification } from '../contexts/GamificationContext';

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  city: string;
  extension?: string;
  avatar: string;
}

export const Diretorio: React.FC = () => {
  const { addActivity } = useGamification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Track directory access
  React.useEffect(() => {
    addActivity('page_visit', 'Acessou o diretório corporativo');
  }, []);

  const employees: Employee[] = [
    {
      id: '1',
      name: 'João Silva',
      position: 'Gerente de Vendas',
      department: 'Vendas',
      email: 'joao.silva@grupocropfield.com.br',
      phone: '(11) 99999-1234',
      city: 'São Paulo',
      extension: '1001',
      avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=150',
    },
    {
      id: '2',
      name: 'Maria Santos',
      position: 'Analista de RH',
      department: 'RH',
      email: 'maria.santos@grupocropfield.com.br',
      phone: '(11) 99999-5678',
      city: 'São Paulo',
      extension: '1002',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=150',
    },
    {
      id: '3',
      name: 'Carlos Oliveira',
      position: 'Desenvolvedor Senior',
      department: 'TI',
      email: 'carlos.oliveira@grupocropfield.com.br',
      phone: '(11) 99999-9012',
      city: 'São Paulo',
      extension: '1003',
      avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=150',
    },
    {
      id: '4',
      name: 'Ana Costa',
      position: 'Contadora',
      department: 'Financeiro',
      email: 'ana.costa@grupocropfield.com.br',
      phone: '(11) 99999-3456',
      city: 'Rio de Janeiro',
      avatar: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?w=150',
    },
    {
      id: '5',
      name: 'Roberto Lima',
      position: 'Supervisor de Produção',
      department: 'Produção',
      email: 'roberto.lima@grupocropfield.com.br',
      phone: '(11) 99999-7890',
      city: 'Belo Horizonte',
      extension: '2001',
      avatar: 'https://images.pexels.com/photos/1024311/pexels-photo-1024311.jpeg?w=150',
    }
  ];

  const departments = Array.from(new Set(employees.map(emp => emp.department))).sort();
  const cities = Array.from(new Set(employees.map(emp => emp.city))).sort();

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === '' || employee.department === selectedDepartment;
    const matchesCity = selectedCity === '' || employee.city === selectedCity;

    return matchesSearch && matchesDepartment && matchesCity;
  });

  const groupedEmployees = filteredEmployees.reduce((groups, employee) => {
    const dept = employee.department;
    if (!groups[dept]) {
      groups[dept] = [];
    }
    groups[dept].push(employee);
    return groups;
  }, {} as Record<string, Employee[]>);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Diretório Corporativo</h1>
          <div className="text-sm text-gray-600">
            {filteredEmployees.length} colaboradores encontrados
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pesquisar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome, cargo ou email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departamento
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos os departamentos</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cidade
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas as cidades</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Employee Directory */}
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
                {departmentEmployees.map(employee => (
                  <div key={employee.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-start space-x-4">
                      <img
                        src={employee.avatar}
                        alt={employee.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{employee.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{employee.position}</p>
                        
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
                            <span className="text-sm text-gray-600">{employee.phone}</span>
                            {employee.extension && (
                              <span className="text-xs text-gray-500">({employee.extension})</span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{employee.city}</span>
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

        {filteredEmployees.length === 0 && (
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