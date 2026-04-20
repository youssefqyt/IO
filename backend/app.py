from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from config import SECRET_KEY
from config import MONGO_URI
from signUp import register_user
from login import login_user
from changepassword import change_password
from MarketPlace import get_marketplace_products, add_marketplace_product
from Messages import get_conversations
from AddProject import add_project
from BrowseProject import get_projects, get_project_details
from SubmitProposal import submit_proposal, get_send_proposals, update_send_proposal_status
from Myjob import get_active_myjobs, update_myjob_workflow_status, deliver_myjob_assets, mark_delivery_viewed
from Pay import pay_product, release_myjob_payment

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
CORS(app)

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

@app.route('/api/change-password', methods=['POST'])
def update_password():
    return change_password(db)


@app.route('/api/marketplace', methods=['GET'])
def marketplace():
    return get_marketplace_products(db)


@app.route('/api/marketplace', methods=['POST'])
def create_marketplace_product():
    return add_marketplace_product(db)


@app.route('/api/conversations', methods=['GET'])
def conversations():
    return get_conversations(db)


@app.route('/api/projects', methods=['GET'])
def browse_projects():
    return get_projects(db)


@app.route('/api/projects/<project_id>', methods=['GET'])
def project_details(project_id):
    return get_project_details(db, project_id)


@app.route('/api/projects', methods=['POST'])
def create_project():
    return add_project(db)


@app.route('/api/proposals', methods=['POST'])
def create_proposal():
    return submit_proposal(db)


@app.route('/api/send-proposals', methods=['GET'])
def list_send_proposals():
    return get_send_proposals(db)


@app.route('/api/send-proposals/<proposal_id>', methods=['PATCH'])
def change_send_proposal_status(proposal_id):
    return update_send_proposal_status(db, proposal_id)


@app.route('/api/myjobs/active', methods=['GET'])
def list_active_myjobs():
    return get_active_myjobs(db)


@app.route('/api/myjobs/<proposal_id>/workflow-status', methods=['PATCH'])
def change_myjob_workflow_status(proposal_id):
    return update_myjob_workflow_status(db, proposal_id)


@app.route('/api/myjobs/<proposal_id>/deliver-assets', methods=['POST'])
def submit_myjob_delivery(proposal_id):
    return deliver_myjob_assets(db, proposal_id)


@app.route('/api/myjobs/<proposal_id>/mark-delivery-viewed', methods=['POST'])
def mark_delivery_viewed_route(proposal_id):
    from Myjob import mark_delivery_viewed
    return mark_delivery_viewed(db, proposal_id)


@app.route('/api/myjobs/<proposal_id>/release-payment', methods=['POST'])
def release_myjob_payment_route(proposal_id):
    from Pay import release_myjob_payment
    return release_myjob_payment(db, proposal_id)


@app.route('/api/pay', methods=['POST'])
def pay():
    return pay_product(db)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0',port=5000)
