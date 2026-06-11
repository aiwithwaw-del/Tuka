import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class SponsorDashboard extends StatefulWidget {
  final String sponsorId;
  const SponsorDashboard({super.key, required this.sponsorId});

  @override
  State<SponsorDashboard> createState() => _SponsorDashboardState();
}

class _SponsorDashboardState extends State<SponsorDashboard> {
  List<dynamic> _submissions = [];
  bool _loading = false;
  String get _baseUrl => 'http://10.0.2.2:3000';

  Future<void> _fetchSubmissions() async {
    setState(() => _loading = true);
    try {
      final res = await http.get(Uri.parse('$_baseUrl/api/sponsor/${widget.sponsorId}/submissions'));
      if (res.statusCode == 200) {
        setState(() => _submissions = json.decode(res.body));
      }
    } catch (e) {
      debugPrint('Error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _approve(String id) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/submissions/$id/approve'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'sponsorId': widget.sponsorId}),
      );
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Approved!'), backgroundColor: Colors.green),
        );
        _fetchSubmissions();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('❌ Failed'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _reject(String id) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject'),
        content: const TextField(maxLines: 3, decoration: InputDecoration(hintText: 'Reason')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, 'Invalid'), child: const Text('Reject')),
        ],
      ),
    );
    
    if (reason != null) {
      try {
        final res = await http.post(
          Uri.parse('$_baseUrl/api/submissions/$id/reject'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'sponsorId': widget.sponsorId, 'reason': reason}),
        );
        if (res.statusCode == 200) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('❌ Rejected'), backgroundColor: Colors.orange),
          );
          _fetchSubmissions();
        }
      } catch (e) {
        debugPrint('Error: $e');
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchSubmissions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('📊 Sponsor Dashboard'), backgroundColor: const Color(0xFF1E40AF)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _submissions.isEmpty
              ? const Center(child: Text('No submissions'))
              : ListView.builder(
                  itemCount: _submissions.length,
                  itemBuilder: (context, i) {
                    final sub = _submissions[i];
                    return Card(
                      margin: const EdgeInsets.all(8),
                      child: ExpansionTile(
                        title: Text(sub['challenge']['title']),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('User: ${sub['user']['name'] ?? 'Unknown'}'),
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: sub['status'] == 'APPROVED' ? Colors.green : 
                                       sub['status'] == 'REJECTED' ? Colors.red : Colors.orange,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(sub['status'], style: const TextStyle(color: Colors.white, fontSize: 12)),
                            ),
                          ],
                        ),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text('Proof: ${sub['proofText']}', style: const TextStyle(fontSize: 14)),
                          ),
                          if (sub['status'] == 'PENDING')
                            ButtonBar(
                              children: [
                                ElevatedButton.icon(
                                  onPressed: () => _approve(sub['id']),
                                  icon: const Icon(Icons.check),
                                  label: const Text('Approve'),
                                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                                ),
                                ElevatedButton.icon(
                                  onPressed: () => _reject(sub['id']),
                                  icon: const Icon(Icons.close),
                                  label: const Text('Reject'),
                                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                ),
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}