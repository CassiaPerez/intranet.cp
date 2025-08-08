diff --git a/src/App.tsx b/src/App.tsx
index 17d98206a546329a0e491d42780645641a2648b0..d2c463763170835e1111f4b4cf754581a9709e4b 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,73 +1,82 @@
 import React from 'react';
 import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
 import { Toaster } from 'react-hot-toast';
 import { AuthProvider } from './contexts/AuthContext';
 import { GamificationProvider } from './contexts/GamificationContext';
 import { ProtectedRoute } from './components/ProtectedRoute';
 import { LoginPage } from './pages/LoginPage';
 import { Dashboard } from './pages/Dashboard';
 import { ReservaSalas } from './pages/ReservaSalas';
 import { Cardapio } from './pages/Cardapio';
 import { Diretorio } from './pages/Diretorio';
 import { Equipamentos } from './pages/Equipamentos';
 import { Mural } from './pages/Mural';
 import { AdminPanel } from './pages/AdminPanel';
+import { TrocaProteinas } from './pages/TrocaProteinas';
 import './index.css';
 
 function App() {
   return (
     <AuthProvider>
       <GamificationProvider>
         <Router>
           <div className="min-h-screen bg-gray-50">
             <Routes>
               <Route path="/login" element={<LoginPage />} />
               <Route
                 path="/"
                 element={
                   <ProtectedRoute>
                     <Dashboard />
                   </ProtectedRoute>
                 }
               />
               <Route
                 path="/reservas"
                 element={
                   <ProtectedRoute>
                     <ReservaSalas />
                   </ProtectedRoute>
                 }
               />
               <Route
                 path="/cardapio"
                 element={
                   <ProtectedRoute>
                     <Cardapio />
                   </ProtectedRoute>
                 }
               />
+              <Route
+                path="/troca-proteina"
+                element={
+                  <ProtectedRoute>
+                    <TrocaProteinas />
+                  </ProtectedRoute>
+                }
+              />
               <Route
                 path="/diretorio"
                 element={
                   <ProtectedRoute>
                     <Diretorio />
                   </ProtectedRoute>
                 }
               />
               <Route
                 path="/equipamentos"
                 element={
                   <ProtectedRoute>
                     <Equipamentos />
                   </ProtectedRoute>
                 }
               />
               <Route
                 path="/mural"
                 element={
                   <ProtectedRoute>
                     <Mural />
                   </ProtectedRoute>
                 }
               />
               <Route
