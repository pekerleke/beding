# Semantic Search Chat Demo

Semantic Search Chat Demo es una aplicación demo de chat que te permite cargar documentos en Weaviate para obtener contexto tipo RAG. La app utiliza técnicas como la condensación de consultas, generación de embeddings, RAG y se utiliza la api de OpenAI para generar respuestas basadas en el contexto.

<img width="862" alt="Screenshot 2025-04-03 at 12 24 24" src="https://github.com/user-attachments/assets/a5920da5-f479-4a93-9cc5-6ee2491c9650" />


## Características

- **Chat interactivo:** Habla con el sistema y recibí respuestas con contexto.
- **Carga de documentos:** Importá documentos en Weaviate para enriquecer el contexto.
- **Historial interno por sesión:** Incorpora un historial por sesión de usuario, permitiendo mantener un contexto separado por cada pestaña
- **Condensación de consultas:** Optimiza las consultas para obtener respuestas más precisas.
- **Embeddings:** Convierte el texto en representaciones vectoriales.
- **Integración con OpenAI:** Se conecta a OpenAI para generar respuestas más naturales y acertadas.

## Requisitos

- **Node.js**
- **Docker**
- **OpenAI api key** (se debe setear en `/server/.env`)

## Instalación y Ejecución

Seguí los pasos en la [Wiki de la App](https://github.com/pekerleke/semantic-search-chat-demo/wiki) para levantar la aplicación por primera vez.

## Notas

Esta aplicación es solo una demo pensada para probar el potencial de la integración entre sistemas de búsqueda semántica y generación de respuestas contextualizadas con contenido propio.
