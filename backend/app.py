from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from config import SECRET_KEY
from config import MONGO_URI
from signUp import register_user
from login import login_user

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
CORS(app)

# MongoDB Connection
client = MongoClient(MONGO_URI)
db = client.get_database("FreeLancerDB")
@app.route('/api/test-db', methods=['GET'])
def test_db():
    try:
        collections = db.list_collection_names()
        return jsonify({"message": "MongoDB connection is working!", "collections": collections}), 200
    except Exception as e:
        return jsonify({"message": "MongoDB connection failed", "error": str(e)}), 500
@app.route('/api/signup', methods=['POST'])
def signup():
    return register_user(db)

@app.route('/api/login', methods=['POST'])
def login():
    return login_user(db)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0',port=5000)
